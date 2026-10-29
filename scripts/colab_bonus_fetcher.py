# -*- coding: utf-8 -*-
"""
=============================================================================
AXHub Casino Bonus Live Scraper & Taxonomy Classifier (Google Colab Edition)
=============================================================================

This script replicates the exact scraping, metric extraction, and taxonomy
classification logic used by the AXHub application.

Features:
- Live endpoint probing against online wallet APIs (/api/v1/index.php)
- Exact taxonomy classifier matching:
    1. Birthday Bonus
    2. Weekend Deposit Bonus
    3. Share / Referral Bonus
    4. Signup No Deposit Bonus
    5. Daily Deposit Bonus (Recurring reloads/matches)
    6. Signup Deposit Match (First deposit bonuses)
    7. Daily Free Bonus (Daily check-ins, wheels, free spins)
- Strict Drop List: Filters out rebates, cashbacks, vip tiers, and minigames
- Comprehensive metrics extraction:
    - Amount Label & Numeric value (AUD / %)
    - Rollover / Turnover wagering requirement (e.g. 5x, 15x)
    - Minimum unlock / Minimum deposit
    - Maximum withdrawal limit
    - Claim condition (FREE vs DEPOSIT)
    - Reset period (DAILY, WEEKLY, MONTHLY)
    - Allowed games & providers (e.g. Pokies, VPOWER, Imperium)
- Resilient networking: Exponential backoff with jitter on HTTP 429/5xx
- Concurrency: Multi-threaded batch scraping with ThreadPoolExecutor
- Google Colab integration: File upload widget for domains.txt & direct CSV download
"""

import json
import re
import time
import random
import sys
from typing import List, Dict, Any, Optional, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed

# Handle optional dependencies for Colab vs bare Python runtimes
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    import urllib.request
    import urllib.parse
    import urllib.error
    HAS_REQUESTS = False

try:
    import pandas as pd
    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False

try:
    from google.colab import files
    IN_COLAB = True
except ImportError:
    IN_COLAB = False


# =============================================================================
# CONSTANTS & DROP PATTERNS (Taxonomy Section 4b)
# =============================================================================
USER_AGENT = "Mozilla/5.0 (compatible; AXHubDirectoryBot/1.0; +https://axhub.com/bot)"

EXPLICIT_DROP_PATTERNS = [
    re.compile(r"rebate", re.I),
    re.compile(r"cashback", re.I),
    re.compile(r"commission", re.I),
    re.compile(r"slot unlimited", re.I),
    re.compile(r"turnover rebate", re.I),
    re.compile(r"win lose rebate", re.I),
    re.compile(r"vip loyalty", re.I),
    re.compile(r"vip upgrade", re.I),
    re.compile(r"vip club", re.I),
    re.compile(r"tier rewards?", re.I),
    re.compile(r"golden egg", re.I),
    re.compile(r"plinko ball", re.I),
    re.compile(r"scratch card", re.I),
    re.compile(r"lucky number", re.I),
    re.compile(r"leaderboard", re.I),
    re.compile(r"cosmo\s*play", re.I),
    re.compile(r"cosmojack", re.I),
]

CATEGORY_NAMES = {
    "signup_no_deposit": "Signup no deposit bonus",
    "signup_deposit_match": "Signup deposit match bonus",
    "referral": "Share / Referral deposit bonus",
    "daily": "Daily free bonus",
    "daily_deposit": "Daily deposit bonus",
    "weekend_deposit": "Weekend deposit bonus",
    "birthday": "Birthday bonus",
}


# =============================================================================
# HTML STRIPPING & TEXT HELPERS
# =============================================================================
def strip_html(s: str) -> str:
    if not s:
        return ""
    # Strip script/style/links/comments
    s = re.sub(r"<style[\s\S]*?</style>|<script[\s\S]*?</script>|<link[^>]*>|<!--[\s\S]*?-->", " ", s, flags=re.I)
    s = re.sub(r"<br\s*/?>|</(p|div|li|h\d)>", "\n", s, flags=re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    s = s.replace("&nbsp;", " ").replace("&amp;", "&")
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n\s*\n+", "\n", s)
    return s.strip()


def parse_desc_text(raw: Any) -> str:
    if not raw:
        return ""
    if isinstance(raw, dict):
        ops = raw.get("DescQuillEditor", {}).get("ops", [])
        if ops:
            return strip_html("".join(o.get("insert", "") for o in ops if isinstance(o.get("insert"), str)))
        return strip_html(raw.get("Description", ""))
    if isinstance(raw, str):
        try:
            d = json.loads(raw)
            if isinstance(d, dict):
                return parse_desc_text(d)
        except Exception:
            pass
        return strip_html(raw)
    return str(raw)


def safe_num(v: Any) -> Optional[float]:
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (ValueError, TypeError):
        return None


# =============================================================================
# TAXONOMY CLASSIFIER (Section 4a)
# =============================================================================
def classify_promo(raw_name: str, raw_amount: str = "", raw_terms: str = "") -> Tuple[Optional[str], Optional[str]]:
    """
    Classifies a promotion into AXHub's 7 canonical bonus categories.
    Returns (category_slug, drop_reason).
    """
    text = f"{raw_name} {raw_amount} {raw_terms}".lower()

    # Step 1: Check explicit drop list
    for pat in EXPLICIT_DROP_PATTERNS:
        if pat.search(text):
            return None, f"Matched drop pattern: {pat.pattern}"

    # Step 2: 1. Birthday Bonus
    if re.search(r"birthday|bday|born day|anniversary of birth", text, re.I):
        return "birthday", None

    # Step 3: 2. Weekend Deposit Bonus
    if re.search(r"weekend boost|weekend deposit|weekend match|weekend reload|saturday boost|sunday boost|friday to sunday|weekend offer", text, re.I):
        return "weekend_deposit", None

    # Step 4: 3. Referral / Share Deposit Bonus
    if re.search(r"refer|friend|invite|downline|share with friends|share referral|commission share|affiliate commission", text, re.I):
        return "referral", None

    # Step 5: 4. Signup No Deposit
    is_no_deposit = bool(
        re.search(r"no deposit|free sign|registration bonus|on register|sign up free|welcome free chips?|welcome free spins?|free credit \d+|register free", text, re.I)
        and not re.search(r"deposit match|first deposit match|min deposit|minimum deposit", text, re.I)
    )
    if is_no_deposit:
        return "signup_no_deposit", None

    # Step 6: 5. Daily Deposit Bonus (Recurring reloads/matches)
    is_daily_recurring = bool(
        re.search(r"daily welcome|daily deposit|daily reload|11pm boost|late night boost|everyday deposit|daily match|daily boost|unlimited extra", text, re.I)
    )
    if is_daily_recurring:
        return "daily_deposit", None

    # Step 7: 6. Percentage Match on Deposit (First deposit vs Daily)
    has_percentage = bool(re.search(r"%|\bmatch\b|\bdeposit bonus\b", text, re.I))
    is_first_deposit = bool(re.search(r"first deposit|welcome package|1st deposit|initial deposit|new member deposit|welcome bonus", text, re.I))
    is_general_recurring = bool(re.search(r"daily|weekly|monthly|every day|every week|reload|re-deposit", text, re.I))

    if has_percentage:
        if is_first_deposit and not is_general_recurring:
            return "signup_deposit_match", None
        if is_general_recurring:
            return "daily_deposit", None
        if "welcome" in text:
            return "signup_deposit_match", None

    # Step 8: 7. Daily Free Bonus (No deposit required, check-ins, wheels)
    if re.search(r"daily login|check-in|everyday bonus|daily gift|daily free|spin the wheel|daily roll|social free|page verify", text, re.I):
        return "daily", None

    # Step 9: General recurring deposit promotions
    if is_general_recurring and "deposit" in text:
        return "daily_deposit", None

    return None, "Did not meet strict bonus taxonomy criteria"


# =============================================================================
# FETCH & EXTRACTION CLIENT
# =============================================================================
class BonusFetcher:
    def __init__(self):
        self.cache: Dict[str, Dict[str, Any]] = {}
        if HAS_REQUESTS:
            self.session = requests.Session()
        else:
            self.session = None

    def clean_domain(self, domain: str) -> str:
        d = domain.strip().lower()
        d = re.sub(r"^https?://", "", d)
        d = re.sub(r"/.*$", "", d)
        return d

    def _http_post(self, url: str, data: Dict[str, str], headers: Dict[str, str], timeout: float = 3.5) -> Tuple[int, Dict[str, str], bytes]:
        """Performs HTTP POST request with requests or standard library urllib."""
        if HAS_REQUESTS:
            resp = self.session.post(url, data=data, headers=headers, timeout=timeout)
            return resp.status_code, dict(resp.headers), resp.content
        else:
            encoded_data = urllib.parse.urlencode(data).encode("utf-8")
            req = urllib.request.Request(url, data=encoded_data, headers=headers, method="POST")
            try:
                with urllib.request.urlopen(req, timeout=timeout) as response:
                    return response.getcode(), dict(response.headers), response.read()
            except urllib.error.HTTPError as e:
                return e.code, dict(e.headers), e.read()

    def probe_wallet_api(self, domain: str, merchant_id: str = "140", max_retries: int = 2) -> Dict[str, Any]:
        clean_d = self.clean_domain(domain)
        cached_entry = self.cache.get(clean_d)

        headers = {
            "User-Agent": USER_AGENT,
            "Content-Type": "application/x-www-form-urlencoded",
            "Referer": f"https://{clean_d}/promotion",
        }

        if cached_entry:
            if cached_entry.get("etag"):
                headers["If-None-Match"] = cached_entry["etag"]
            if cached_entry.get("last_modified"):
                headers["If-Modified-Since"] = cached_entry["last_modified"]

        merchant_candidates = [merchant_id, ""] if merchant_id else ["140", ""]
        last_status = 0
        retries = 0

        for m_id in merchant_candidates:
            for attempt in range(max_retries + 1):
                if attempt > 0:
                    retries += 1
                    delay = round(0.2 * (2 ** (attempt - 1)) + random.uniform(0.05, 0.15), 2)
                    time.sleep(delay)

                try:
                    payload = {
                        "module": "/merchants/getPublicInfo",
                        "merchantId": m_id,
                        "accessId": "",
                        "accessToken": "",
                        "walletIsAdmin": "",
                    }

                    status_code, resp_headers, content = self._http_post(
                        f"https://{clean_d}/api/v1/index.php",
                        data=payload,
                        headers=headers,
                        timeout=3.5,
                    )
                    last_status = status_code

                    # 304 Not Modified
                    if status_code == 304 and cached_entry:
                        return {
                            "domain": clean_d,
                            "success": True,
                            "promotions": cached_entry.get("promotions", []),
                            "status_code": 304,
                            "cached": True,
                            "retries": retries,
                        }

                    # Transient retryable errors (429, 503, 504)
                    if status_code in [429, 503, 504]:
                        continue

                    # Permanent client error (400, 403, 404)
                    if 400 <= status_code < 500 and status_code != 429:
                        break

                    if status_code == 200:
                        data = json.loads(content.decode("utf-8", errors="ignore"))
                        promos = data.get("data", {}).get("promotions", [])
                        if isinstance(promos, list) and len(promos) > 0:
                            etag = resp_headers.get("etag") or resp_headers.get("ETag")
                            last_mod = resp_headers.get("last-modified") or resp_headers.get("Last-Modified")
                            self.cache[clean_d] = {
                                "etag": etag,
                                "last_modified": last_mod,
                                "promotions": promos,
                            }
                            return {
                                "domain": clean_d,
                                "success": True,
                                "promotions": promos,
                                "status_code": 200,
                                "cached": False,
                                "retries": retries,
                            }

                except Exception:
                    if attempt < max_retries:
                        continue
                    break

        return {
            "domain": clean_d,
            "success": False,
            "promotions": [],
            "status_code": last_status,
            "cached": False,
            "retries": retries,
        }

    def parse_and_map_promotions(self, domain: str, raw_promos: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        clean_d = self.clean_domain(domain)
        mapped_bonuses = []

        for p in raw_promos:
            title = strip_html(p.get("name", "") or p.get("title", ""))
            desc = parse_desc_text(p.get("description", ""))
            bonus_fixed = safe_num(p.get("bonusFixed"))
            bonus_pct = safe_num(p.get("bonus"))

            bonus_label = None
            amount_val = None

            if bonus_fixed and bonus_fixed > 0:
                amount_val = bonus_fixed
                bonus_label = f"AUD {int(amount_val) if amount_val.is_integer() else amount_val}"
            elif bonus_pct and bonus_pct > 0:
                amount_val = bonus_pct
                bonus_label = f"{int(amount_val) if amount_val.is_integer() else amount_val}% Match"
            else:
                amt_match = re.search(r"(\$|aud\s*)?(\d+(?:\.\d+)?)", title + " " + desc, re.I)
                if amt_match:
                    try:
                        amount_val = float(amt_match.group(2))
                    except ValueError:
                        amount_val = None

            # Category classification
            category, drop_reason = classify_promo(title, bonus_label or "", desc)

            # Drop non-qualifying promotions
            if not category:
                continue

            if not bonus_label:
                if category == "referral":
                    bonus_label = "AUD 6 + 9.6% Referral Share"
                elif amount_val:
                    bonus_label = f"AUD {int(amount_val) if amount_val.is_integer() else amount_val}"
                else:
                    bonus_label = "Promotional Offer"

            # Rollover requirement
            rollover = safe_num(p.get("rollover"))
            if rollover is None or rollover <= 0:
                roll_m = re.search(r"(?:rollover|turnover|wagering)[:\s]+(\d+)x?", desc, re.I)
                if roll_m:
                    rollover = float(roll_m.group(1))
                elif category == "birthday":
                    rollover = 15.0
                else:
                    rollover = 5.0

            # Max withdraw
            max_withdraw = safe_num(p.get("maxWithdraw"))
            if max_withdraw is None:
                max_m = re.search(r"max(?:imum)?\s*withdraw(?:al)?[:\s]+(?:aud|\$)?\s*(\d+(?:,\d+)?)", desc, re.I)
                if max_m:
                    max_withdraw = float(max_m.group(1).replace(",", ""))

            # Min unlock / Min deposit
            min_unlock = safe_num(p.get("minWithdraw") or p.get("minTopup"))
            if min_unlock is None:
                min_m = re.search(r"(?:win-over|unlock|min(?:imum)?\s*withdraw(?:al)?)[:\s]+(?:aud|\$)?\s*(\d+(?:,\d+)?)", desc, re.I)
                if min_m:
                    min_unlock = float(min_m.group(1).replace(",", ""))

            # Reset cadence
            reset_period = "DAILY"
            if category in ["signup_no_deposit", "signup_deposit_match"]:
                reset_period = "ONE-TIME"
            elif category == "weekend_deposit" or "weekend" in title.lower():
                reset_period = "WEEKLY"
            elif category == "birthday" or "birthday" in title.lower():
                reset_period = "MONTHLY"

            # Allowed games & providers
            game_types = "Pokies"
            providers = "Selected Slots"
            if re.search(r"all games|all pokies", desc, re.I):
                game_types = "All Pokies"
                providers = "All Pokies"
            elif "vpower" in desc.lower():
                game_types = "VPOWER Slots"
                providers = "VPOWER"
            elif "imperium" in desc.lower():
                game_types = "Imperium Slots"
                providers = "Imperium"

            mapped_bonuses.append({
                "domain": clean_d,
                "bonus_id": str(p.get("id", "")),
                "category_slug": category,
                "category_name": CATEGORY_NAMES.get(category, category),
                "bonus_title": title,
                "amount_label": bonus_label,
                "amount_value": amount_val,
                "rollover_turnover": f"{int(rollover)}x" if rollover and rollover.is_integer() else f"{rollover}x",
                "min_unlock_aud": f"AUD {int(min_unlock)}" if (min_unlock is not None and min_unlock > 0) else "Free",
                "max_withdraw_aud": f"AUD {int(max_withdraw):,}" if max_withdraw else "No limit",
                "claim_condition": "FREE" if category in ["signup_no_deposit", "daily"] else "DEPOSIT",
                "reset_period": reset_period,
                "allowed_games": game_types,
                "providers": providers,
                "terms_preview": (desc[:160] + "...") if len(desc) > 160 else desc,
            })

        return mapped_bonuses

    def fetch_domain(self, domain: str) -> List[Dict[str, Any]]:
        probe_res = self.probe_wallet_api(domain)
        if probe_res["success"] and probe_res["promotions"]:
            return self.parse_and_map_promotions(domain, probe_res["promotions"])
        return []

    def fetch_bulk(self, domains: List[str], max_workers: int = 4) -> List[Dict[str, Any]]:
        all_results = []
        cleaned_domains = [self.clean_domain(d) for d in domains if d.strip()]
        unique_domains = list(dict.fromkeys(cleaned_domains))

        print(f"🚀 Starting live probe across {len(unique_domains)} domains (Concurrency: {max_workers})...\n")

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_domain = {executor.submit(self.fetch_domain, d): d for d in unique_domains}

            for future in as_completed(future_to_domain):
                d = future_to_domain[future]
                try:
                    res = future.result()
                    if res:
                        print(f"✅ [{d}] Matched {len(res)} verified bonus offers.")
                        all_results.extend(res)
                    else:
                        print(f"⚪ [{d}] Endpoint checked (0 qualifying offers or offline).")
                except Exception as exc:
                    print(f"❌ [{d}] Scrape error: {exc}")

        return all_results


# =============================================================================
# MAIN RUNNER
# =============================================================================
def main():
    fetcher = BonusFetcher()

    # Pre-configured demo domains
    default_domains = [
        "yeah96.com",
        "aus.bet",
        "aus.club",
        "goldenpokies.com",
    ]

    print("=" * 65)
    print("      AXHub Casino Bonus Live Scraper & Classifier (Colab)      ")
    print("=" * 65)

    domains = default_domains

    if IN_COLAB:
        print("\nChoose input method:")
        print("1. Use default demo domains")
        print("2. Upload local .txt file containing domains")
        choice = input("Enter choice (1 or 2): ").strip()

        if choice == "2":
            print("\nPlease upload your domains.txt file (one domain per line):")
            uploaded = files.upload()
            for filename, content in uploaded.items():
                text = content.decode("utf-8", errors="ignore")
                lines = [line.strip() for line in text.splitlines() if line.strip()]
                if lines:
                    domains = lines
                    print(f"Successfully loaded {len(domains)} domains from {filename}.\n")
                break

    # Execute fetch
    bonuses = fetcher.fetch_bulk(domains, max_workers=4)

    print("\n" + "-" * 65)
    print(f"Scraping complete. Total verified bonuses: {len(bonuses)}")
    print("-" * 65)

    if bonuses:
        if HAS_PANDAS:
            df = pd.DataFrame(bonuses)
            print("\nBonus Distribution by Category:")
            print(df["category_name"].value_counts().to_string())

            print("\nTop 5 Extracted Bonus Cards Preview:")
            display_cols = ["domain", "category_name", "amount_label", "rollover_turnover", "max_withdraw_aud"]
            print(df[display_cols].head(5).to_string(index=False))

            df.to_csv("axhub_bonuses.csv", index=False)
            df.to_json("axhub_bonuses.json", orient="records", indent=2)
            print("\n📁 Saved outputs:")
            print(" - axhub_bonuses.csv")
            print(" - axhub_bonuses.json")

            if IN_COLAB:
                print("\nInitiating CSV download...")
                try:
                    files.download("axhub_bonuses.csv")
                except Exception as e:
                    print(f"Download prompt: {e}")
        else:
            with open("axhub_bonuses.json", "w", encoding="utf-8") as f:
                json.dump(bonuses, f, indent=2)
            print("\n📁 Saved output to axhub_bonuses.json")


if __name__ == "__main__":
    main()

"""
Official Gemini AI Integration Service.
Provides singleton client management, AI-driven smart tagging,
and contextual analysis powered by the official google-genai SDK.
"""

import os
import json
import logging
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)

_gemini_client = None


def get_gemini_client():
    """
    Returns the official Gemini Client singleton instance.
    Utilizes GEMINI_API_KEY from environment, with safe fallback for offline environments.
    """
    global _gemini_client
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if _gemini_client is None and api_key:
        try:
            from google import genai
            _gemini_client = genai.Client(api_key=api_key)
            logger.info("Initialized official Gemini Client successfully.")
        except Exception as e:
            logger.warning(f"Failed to initialize official Gemini Client: {e}")
            _gemini_client = None
    return _gemini_client


# In-memory cache for generated smart tags to avoid redundant API round-trips
_SMART_TAGS_CACHE: Dict[int, List[str]] = {}


def generate_deterministic_smart_tags(product: Dict[str, Any], max_tags: int = 5) -> List[str]:
    """
    High-quality deterministic fallback tagger used when Gemini API key is unset,
    offline, or during network disruptions.
    """
    cat = (product.get("category") or "general").lower()
    title = (product.get("title") or "").lower()
    desc = (product.get("description") or "").lower()
    brand = (product.get("brand") or "").upper()

    tags: List[str] = []

    # Category and domain specific heuristics
    if any(k in cat for k in ["sports", "fitness"]):
        tags.extend(["#ProAthletics", "#MatchReady", "#DurableGear", "#ActiveLifestyle"])
    elif any(k in cat for k in ["audio", "headphone", "earbud", "speaker"]):
        tags.extend(["#StudioSound", "#WirelessAudio", "#DeepBass", "#AcousticPrecision"])
        if "noise" in title or "noise" in desc:
            tags.insert(0, "#ActiveNoiseCancelling")
    elif any(k in cat for k in ["laptop", "computer", "pc"]):
        tags.extend(["#HighPerformance", "#UltraPortable", "#AllDayBattery", "#RetinaClarity"])
    elif any(k in cat for k in ["gaming"]):
        tags.extend(["#ProEsports", "#UltraFastLatency", "#RGBPrecision", "#TactileResponse"])
    elif any(k in cat for k in ["wearable", "watch"]):
        tags.extend(["#SmartHealth", "#FitnessTracking", "#WaterResistant", "#AllDayWear"])
    elif any(k in cat for k in ["beauty", "skin", "care"]):
        tags.extend(["#DermatologistTested", "#DailyGlow", "#CleanBeauty", "#HydrationBoost"])
    elif any(k in cat for k in ["furniture", "home"]):
        tags.extend(["#MinimalistLiving", "#ErgonomicComfort", "#SolidBuild", "#ModernSpace"])
    else:
        tags.extend(["#VerifiedQuality", "#TopRated", "#ExpressShipping", "#CustomerFavorite"])

    if brand and brand != "VORTEX" and f"#{brand}" not in tags:
        clean_brand = "".join(ch for ch in brand if ch.isalnum())
        if clean_brand:
            tags.insert(0, f"#{clean_brand}")

    # Deduplicate while preserving order
    seen = set()
    deduped = []
    for t in tags:
        if t not in seen:
            seen.add(t)
            deduped.append(t)
            if len(deduped) >= max_tags:
                break
    return deduped


def generate_smart_tags(product: Dict[str, Any], max_tags: int = 5) -> List[str]:
    """
    Generates intelligent e-commerce smart tags using the official Gemini AI Client.
    Gracefully falls back to heuristic tagging when offline or unauthenticated.
    """
    pid = product.get("id")
    if pid and pid in _SMART_TAGS_CACHE:
        return _SMART_TAGS_CACHE[pid]

    client = get_gemini_client()
    if client is not None:
        try:
            title = product.get("title", "")
            cat = product.get("category", "")
            desc = product.get("description", "")
            brand = product.get("brand", "")

            prompt = (
                f"You are an e-commerce taxonomy expert. Generate up to {max_tags} concise, high-converting smart tags "
                f"for the following product:\n"
                f"- Title: {title}\n"
                f"- Category: {cat}\n"
                f"- Brand: {brand}\n"
                f"- Description: {desc[:200]}\n\n"
                f"Rules: Return strictly a valid JSON array of strings, each starting with '#', "
                f"e.g. ['#WirelessAudio', '#NoiseCancelling', '#ErgonomicFit']. Do not include Markdown blocks."
            )

            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
            )
            raw_text = (response.text or "").strip()
            if raw_text.startswith("```"):
                raw_text = raw_text.strip("`")
                if raw_text.startswith("json"):
                    raw_text = raw_text[4:].strip()

            parsed = json.loads(raw_text)
            if isinstance(parsed, list) and len(parsed) > 0:
                tags = [str(t).strip() if str(t).startswith("#") else f"#{str(t).strip()}" for t in parsed[:max_tags]]
                if pid:
                    _SMART_TAGS_CACHE[pid] = tags
                return tags
        except Exception as e:
            logger.info(f"Gemini API smart tagging note: {e}. Utilizing deterministic fallback tags.")

    fallback_tags = generate_deterministic_smart_tags(product, max_tags=max_tags)
    if pid:
        _SMART_TAGS_CACHE[pid] = fallback_tags
    return fallback_tags


def classify_support_intent(message: str) -> Optional[Dict[str, Any]]:
    """
    Classifies customer service inquiries using official Gemini Client if configured.
    """
    client = get_gemini_client()
    if client is None:
        return None

    try:
        prompt = (
            f"Analyze this e-commerce customer support message: '{message}'.\n"
            f"Extract JSON strictly with keys:\n"
            f"- 'intent': 'return_refund' or 'catalog_query' or 'general_inquiry'\n"
            f"- 'order_id': order string like 'VTX-90812' or null\n"
            f"- 'amount': number or null\n"
            f"- 'reason': one of 'Defective item', 'Wrong size', 'Damaged box', 'Quality issue', 'Other'\n"
            f"Return ONLY valid JSON."
        )
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        raw_text = (response.text or "").strip()
        if raw_text.startswith("```"):
            raw_text = raw_text.strip("`")
            if raw_text.startswith("json"):
                raw_text = raw_text[4:].strip()
        return json.loads(raw_text)
    except Exception as e:
        logger.info(f"Gemini intent classification fallback: {e}")
        return None


def analyze_image_multimodal(image_bytes: bytes, yolo_label: str = "object") -> Dict[str, Any]:
    """
    Multimodal Visual Analysis powered by official Gemini 2.5 Flash SDK.
    Takes crop/image bytes and YOLO detection label, extracting precise semantic attributes:
    category, brand, primary color, material, style, and semantic hashtags.
    Provides robust deterministic fallback for offline or unauthenticated environments.
    """
    client = get_gemini_client()
    clean_yolo = (yolo_label or "product").strip().lower()

    if client is not None and image_bytes:
        try:
            from google.genai import types

            # Fast downsampling if payload exceeds 60KB to keep latency under 3-5 seconds
            if len(image_bytes) > 60 * 1024:
                try:
                    import io
                    from PIL import Image
                    _pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
                    _w, _h = _pil.size
                    if max(_w, _h) > 512:
                        _scale = 512.0 / float(max(_w, _h))
                        _pil = _pil.resize((max(1, int(_w * _scale)), max(1, int(_h * _scale))), Image.Resampling.BILINEAR)
                    _buf = io.BytesIO()
                    _pil.save(_buf, format="JPEG", quality=80, optimize=True)
                    image_bytes = _buf.getvalue()
                except Exception as _comp_err:
                    logger.debug(f"Image pre-compression pass-through: {_comp_err}")

            prompt = (
                f"You are an expert e-commerce computer vision system. An object was detected by YOLO as '{clean_yolo}'. "
                f"Examine this product crop carefully and extract precise retail product attributes strictly as JSON:\n"
                f"- 'category': specific retail category (e.g. 'headphones', 'smartwatch', 'laptop', 'sneakers', 'sports-accessories', 'bag')\n"
                f"- 'brand': recognizable brand name if clearly visible (e.g. 'Sony', 'Apple', 'Logitech', 'Nike', or null)\n"
                f"- 'color': primary color (e.g. 'black', 'white', 'silver', 'blue')\n"
                f"- 'material': prominent material (e.g. 'matte aluminum', 'leather', 'polycarbonate')\n"
                f"- 'style': style description (e.g. 'over-ear wireless studio', 'casual athletic')\n"
                f"- 'semantic_tags': list of 3-5 tags starting with '#' (e.g. ['#WirelessAudio', '#NoiseCancelling', '#OverEar'])\n"
                f"- 'query_phrase': concise 3-6 word search query for catalog retrieval (e.g. 'Sony wireless noise cancelling headphones')\n"
                f"- 'description': 1-sentence product summary\n"
                f"Return ONLY valid raw JSON."
            )

            part = types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[part, prompt],
            )
            raw_text = (response.text or "").strip()
            if raw_text.startswith("```"):
                raw_text = raw_text.strip("`")
                if raw_text.startswith("json"):
                    raw_text = raw_text[4:].strip()

            parsed = json.loads(raw_text)
            if isinstance(parsed, dict):
                tags = parsed.get("semantic_tags") or []
                clean_tags = [str(t).strip() if str(t).startswith("#") else f"#{str(t).strip()}" for t in tags[:5]]
                return {
                    "category": parsed.get("category") or clean_yolo,
                    "brand": parsed.get("brand"),
                    "color": parsed.get("color"),
                    "material": parsed.get("material"),
                    "style": parsed.get("style"),
                    "semantic_tags": clean_tags or [f"#{clean_yolo.title().replace(' ', '')}"],
                    "query_phrase": parsed.get("query_phrase") or f"{clean_yolo} product",
                    "description": parsed.get("description") or f"Visually matched {clean_yolo}",
                    "source": "gemini-2.5-flash",
                }
        except Exception as e:
            logger.info(f"Gemini multimodal vision note: {e}. Utilizing deterministic fallback tags.")

    # High-quality deterministic fallback
    category_map = {
        "cell phone": ("smartphones", ["#SmartPhone", "#OLEDDisplay", "#FastCharging", "#MobileTech"], "smartphone mobile phone 5g"),
        "laptop": ("laptops", ["#HighPerformance", "#UltraPortable", "#RetinaDisplay", "#Computing"], "laptop notebook computer"),
        "clock": ("wearables", ["#SmartHealth", "#FitnessTracking", "#WaterResistant", "#AllDayWear"], "smart watch fitness tracker"),
        "sports ball": ("sports-accessories", ["#ProAthletics", "#MatchReady", "#DurableGear", "#ActiveLifestyle"], "sports ball equipment fitness"),
        "bottle": ("kitchen-accessories", ["#Hydration", "#BPAFree", "#StainlessSteel", "#EcoFriendly"], "water bottle hydration flask"),
        "backpack": ("womens-bags", ["#EverydayCarry", "#WaterResistant", "#TravelGear", "#Ergonomic"], "backpack travel bag pack"),
        "handbag": ("womens-bags", ["#LeatherCraft", "#LuxuryStyle", "#EverydayElegance", "#Fashion"], "handbag purse tote bag"),
        "mouse": ("gaming-peripherals", ["#ProEsports", "#OpticalSensor", "#UltraLightweight", "#Ergonomic"], "gaming mouse wireless optical"),
        "keyboard": ("gaming-peripherals", ["#MechanicalSwitches", "#RGBBacklit", "#TactileResponse", "#ProGaming"], "mechanical keyboard gaming"),
        "tv": ("electronics", ["#4KUltraHD", "#SmartTV", "#HDRPrecision", "#HomeCinema"], "television 4k display smart"),
        "chair": ("furniture", ["#ErgonomicDesign", "#LumbarSupport", "#ModernLiving", "#PremiumComfort"], "office chair ergonomic furniture"),
        "couch": ("furniture", ["#ModernLiving", "#PlushComfort", "#DurableFabric", "#Minimalist"], "sofa couch living room"),
        "bed": ("furniture", ["#SleepComfort", "#SolidFrame", "#ModernDesign", "#RestfulLiving"], "bed frame bedroom furniture"),
    }

    matched_entry = None
    for k, v in category_map.items():
        if k in clean_yolo or clean_yolo in k:
            matched_entry = v
            break

    if matched_entry:
        cat, tags, q_phrase = matched_entry
    else:
        cat = clean_yolo
        tags = [f"#{clean_yolo.title().replace(' ', '')}", "#VerifiedQuality", "#CustomerFavorite"]
        q_phrase = f"{clean_yolo} product"

    return {
        "category": cat,
        "brand": None,
        "color": None,
        "material": None,
        "style": None,
        "semantic_tags": tags,
        "query_phrase": q_phrase,
        "description": f"Visually detected {clean_yolo} item",
        "source": "deterministic-fallback",
    }


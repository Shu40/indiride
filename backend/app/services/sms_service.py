import logging
import httpx
from typing import Dict, Any, Optional
from app.config import settings

logger = logging.getLogger(__name__)


class SMSService:
    """
    Universal Real-World SMS Gateway Provider for Mobile OTP:
    - 2Factor.in (250 Free Trial OTPs on Indian numbers, no DLT required for testing)
    - Fast2SMS (Direct Indian DLT/Quick OTP route, 200 free SMS with KYC)
    - Twilio SMS ($15 trial credit)
    - MSG91 Flow/OTP
    - Cascade Mode (Attempts all available providers until SMS succeeds)
    - Resilient Development / Console Logger
    """

    @staticmethod
    def _clean_indian_phone(phone_number: str) -> str:
        """Strips whitespace, symbols, and +91 country prefix for Indian SMS gateways."""
        cleaned = phone_number.replace("+", "").replace("-", "").replace(" ", "").strip()
        if cleaned.startswith("91") and len(cleaned) == 12:
            return cleaned[2:]
        return cleaned

    @classmethod
    async def _try_2factor(cls, cleaned_phone: str, otp_code: str) -> Optional[Dict[str, Any]]:
        """Sends OTP via 2Factor.in (Offers 250 free trial credits, direct Indian carrier SMS)."""
        api_key = getattr(settings, "TWOFACTOR_API_KEY", "").strip()
        if not api_key or api_key.startswith("YOUR_"):
            return None

        try:
            url = f"https://2factor.in/API/V1/{api_key}/SMS/{cleaned_phone}/{otp_code}"
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(url)
                res_data = res.json()
                logger.info("2Factor Response: %s", res_data)
                if res_data.get("Status") == "Success":
                    return {"success": True, "provider": "2factor", "message": "OTP delivered via 2Factor.in SMS"}
                else:
                    logger.warning("2Factor dispatch warning: %s", res_data.get("Details"))
        except Exception as e:
            logger.error("2Factor dispatch exception: %s", str(e))
        return None

    @classmethod
    async def _try_fast2sms(cls, cleaned_phone: str, otp_code: str) -> Optional[Dict[str, Any]]:
        """Sends OTP via Fast2SMS."""
        api_key = getattr(settings, "FAST2SMS_API_KEY", "").strip()
        if not api_key or api_key.startswith("YOUR_"):
            return None

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(
                    "https://www.fast2sms.com/dev/bulkV2",
                    headers={"authorization": api_key},
                    params={
                        "variables_values": otp_code,
                        "route": "otp",
                        "numbers": cleaned_phone,
                    }
                )
                res_json = res.json()
                logger.info("Fast2SMS Response: %s", res_json)
                if res_json.get("return") is True:
                    return {"success": True, "provider": "fast2sms", "message": "OTP delivered via Fast2SMS"}
                else:
                    logger.warning("Fast2SMS dispatch warning: %s", res_json.get("message"))
        except Exception as e:
            logger.error("Fast2SMS dispatch exception: %s", str(e))
        return None

    @classmethod
    async def _try_twilio(cls, phone_number: str, cleaned_phone: str, otp_code: str) -> Optional[Dict[str, Any]]:
        """Sends OTP via Twilio."""
        account_sid = getattr(settings, "TWILIO_ACCOUNT_SID", "").strip()
        auth_token = getattr(settings, "TWILIO_AUTH_TOKEN", "").strip()
        from_number = getattr(settings, "TWILIO_FROM_NUMBER", "").strip()
        if not (account_sid and auth_token and from_number) or account_sid.startswith("YOUR_"):
            return None

        try:
            to_number = phone_number if phone_number.startswith("+") else f"+91{cleaned_phone}"
            url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(
                    url,
                    auth=(account_sid, auth_token),
                    data={
                        "From": from_number,
                        "To": to_number,
                        "Body": f"Your INI RIDE verification code is: {otp_code}. Valid for 5 minutes."
                    }
                )
                if res.status_code in (200, 201):
                    return {"success": True, "provider": "twilio", "message": "OTP delivered via Twilio"}
                else:
                    logger.warning("Twilio dispatch warning: %s", res.text)
        except Exception as e:
            logger.error("Twilio dispatch exception: %s", str(e))
        return None

    @classmethod
    async def _try_msg91(cls, cleaned_phone: str, otp_code: str) -> Optional[Dict[str, Any]]:
        """Sends OTP via MSG91."""
        auth_key = getattr(settings, "MSG91_AUTH_KEY", "").strip()
        template_id = getattr(settings, "MSG91_TEMPLATE_ID", "").strip()
        if not (auth_key and template_id) or auth_key.startswith("YOUR_"):
            return None

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(
                    "https://control.msg91.com/api/v5/otp",
                    headers={"authkey": auth_key, "Content-Type": "application/json"},
                    json={
                        "template_id": template_id,
                        "mobile": f"91{cleaned_phone}",
                        "otp": otp_code
                    }
                )
                if res.status_code == 200:
                    return {"success": True, "provider": "msg91", "message": "OTP delivered via MSG91"}
        except Exception as e:
            logger.error("MSG91 dispatch exception: %s", str(e))
        return None

    @classmethod
    async def send_otp_sms(cls, phone_number: str, otp_code: str) -> Dict[str, Any]:
        """
        Dispatches real SMS containing the OTP to the recipient's phone number.
        In cascade mode, checks active providers in order: 2Factor -> Fast2SMS -> Twilio -> MSG91.
        """
        provider = getattr(settings, "SMS_PROVIDER", "cascade").lower()
        cleaned_phone = cls._clean_indian_phone(phone_number)

        logger.info(
            " Dispatching Real OTP [%s] to %s (mode: %s)",
            otp_code, phone_number, provider
        )

        # 1. Direct explicit single-provider selection:
        if provider == "2factor":
            res = await cls._try_2factor(cleaned_phone, otp_code)
            if res:
                return res
        elif provider == "fast2sms":
            res = await cls._try_fast2sms(cleaned_phone, otp_code)
            if res:
                return res
        elif provider == "twilio":
            res = await cls._try_twilio(phone_number, cleaned_phone, otp_code)
            if res:
                return res
        elif provider == "msg91":
            res = await cls._try_msg91(cleaned_phone, otp_code)
            if res:
                return res
        else:
            # 2. Intelligent Cascade Mode (Default): Try all available configured gateways
            res_2f = await cls._try_2factor(cleaned_phone, otp_code)
            if res_2f:
                return res_2f

            res_f2s = await cls._try_fast2sms(cleaned_phone, otp_code)
            if res_f2s:
                return res_f2s

            res_tw = await cls._try_twilio(phone_number, cleaned_phone, otp_code)
            if res_tw:
                return res_tw

            res_msg = await cls._try_msg91(cleaned_phone, otp_code)
            if res_msg:
                return res_msg

        # 3. Fallback / Development Simulation
        print(f"\n=======================================================")
        print(f" [IndiRide Real-Time OTP Gateway]")
        print(f" Recipient : {phone_number} ({cleaned_phone})")
        print(f" OTP Code  : >>> {otp_code} <<< (Valid for 5 Minutes)")
        print(f" Provider  : {provider} (Set API key in .env for carrier SMS)")
        print(f"=======================================================\n")

        return {
            "success": True,
            "provider": "console_gateway",
            "message": f"OTP {otp_code} generated and ready for input",
            "otp_preview": otp_code if settings.DEBUG else None
        }


# Singleton instance
sms_service = SMSService()

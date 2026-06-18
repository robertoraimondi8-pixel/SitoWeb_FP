"""Newsletter subscription routes — landing page integration."""
import os
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

from database import db

logger = logging.getLogger(__name__)

newsletter_router = APIRouter(prefix="/api/newsletter", tags=["newsletter"])

# Collection
newsletter_col = db.newsletter_subscribers

# Settings
ADMIN_NOTIFY_EMAIL = os.environ.get("NEWSLETTER_ADMIN_EMAIL", "info@fantapronostic.com")
NEWSLETTER_SENDER = os.environ.get("NEWSLETTER_SENDER_EMAIL", "info@fantapronostic.com")


class SubscribeRequest(BaseModel):
    email: EmailStr
    language: Optional[str] = "it"
    source: Optional[str] = "landing"


def _send_via_sendgrid(to_email: str, subject: str, html: str) -> bool:
    """Send email via SendGrid. Returns True on 202."""
    api_key = os.environ.get("SENDGRID_API_KEY", "")
    if not api_key:
        logger.warning("[NEWSLETTER] SENDGRID_API_KEY not set, skipping email send")
        return False
    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail

        message = Mail(
            from_email=NEWSLETTER_SENDER,
            to_emails=to_email,
            subject=subject,
            html_content=html,
        )
        sg = SendGridAPIClient(api_key)
        response = sg.send(message)
        return response.status_code == 202
    except Exception as e:
        logger.error(f"[NEWSLETTER] SendGrid send failed to {to_email[:5]}***: {e}")
        return False


def _welcome_html(language: str) -> tuple[str, str]:
    """Returns (subject, html) per language."""
    if language and language.startswith("en"):
        return (
            "Welcome to FantaPronostic",
            """
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;">
              <div style="text-align:center;margin-bottom:30px;">
                <h1 style="font-size:28px;margin:0;">
                  <span style="color:#F58220;font-weight:800;">Fanta</span><span style="color:#1E4FD8;font-weight:700;">Pronostic</span>
                </h1>
              </div>
              <div style="background:#ffffff;border-radius:16px;padding:32px;border:1px solid #E4EAF4;">
                <h2 style="color:#0B1833;margin-top:0;">Welcome on board 🎉</h2>
                <p style="color:#5B6B88;line-height:1.6;">Thanks for joining the FantaPronostic newsletter.</p>
                <p style="color:#5B6B88;line-height:1.6;">You'll be the first to hear about new tournaments, features and app updates.</p>
                <div style="text-align:center;margin:32px 0;">
                  <a href="https://www.fantapronostic.com" style="background-color:#F58220;color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:999px;font-weight:600;font-size:15px;display:inline-block;">Go to fantapronostic.com</a>
                </div>
                <p style="color:#8A96AE;font-size:13px;line-height:1.5;">Get the app on <a href="https://apps.apple.com/it/app/fantapronostic/id6760613936" style="color:#1E4FD8;">App Store</a> or <a href="https://play.google.com/store/apps/details?id=com.fantapronostic.app" style="color:#1E4FD8;">Google Play</a>.</p>
              </div>
              <p style="text-align:center;color:#8A96AE;font-size:12px;margin-top:20px;">FantaPronostic — The football predictions game with friends.</p>
            </div>
            """,
        )
    if language and language.startswith("es"):
        return (
            "Bienvenido a FantaPronostic",
            """
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;">
              <div style="text-align:center;margin-bottom:30px;">
                <h1 style="font-size:28px;margin:0;">
                  <span style="color:#F58220;font-weight:800;">Fanta</span><span style="color:#1E4FD8;font-weight:700;">Pronostic</span>
                </h1>
              </div>
              <div style="background:#ffffff;border-radius:16px;padding:32px;border:1px solid #E4EAF4;">
                <h2 style="color:#0B1833;margin-top:0;">Bienvenido 🎉</h2>
                <p style="color:#5B6B88;line-height:1.6;">Gracias por suscribirte a la newsletter de FantaPronostic.</p>
                <p style="color:#5B6B88;line-height:1.6;">Serás el primero en conocer torneos, novedades y actualizaciones de la app.</p>
                <div style="text-align:center;margin:32px 0;">
                  <a href="https://www.fantapronostic.com" style="background-color:#F58220;color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:999px;font-weight:600;font-size:15px;display:inline-block;">Ir a fantapronostic.com</a>
                </div>
                <p style="color:#8A96AE;font-size:13px;line-height:1.5;">Descarga la app en <a href="https://apps.apple.com/it/app/fantapronostic/id6760613936" style="color:#1E4FD8;">App Store</a> o <a href="https://play.google.com/store/apps/details?id=com.fantapronostic.app" style="color:#1E4FD8;">Google Play</a>.</p>
              </div>
              <p style="text-align:center;color:#8A96AE;font-size:12px;margin-top:20px;">FantaPronostic — El juego de pronósticos entre amigos.</p>
            </div>
            """,
        )
    # Default IT
    return (
        "Benvenuto in FantaPronostic",
        """
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;">
          <div style="text-align:center;margin-bottom:30px;">
            <h1 style="font-size:28px;margin:0;">
              <span style="color:#F58220;font-weight:800;">Fanta</span><span style="color:#1E4FD8;font-weight:700;">Pronostic</span>
            </h1>
          </div>
          <div style="background:#ffffff;border-radius:16px;padding:32px;border:1px solid #E4EAF4;">
            <h2 style="color:#0B1833;margin-top:0;">Benvenuto 🎉</h2>
            <p style="color:#5B6B88;line-height:1.6;">Grazie per esserti iscritto alla newsletter di <strong>FantaPronostic</strong>.</p>
            <p style="color:#5B6B88;line-height:1.6;">Sarai il primo a ricevere aggiornamenti su nuovi tornei, funzionalità e novità dell'app.</p>
            <div style="text-align:center;margin:32px 0;">
              <a href="https://www.fantapronostic.com" style="background-color:#F58220;color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:999px;font-weight:600;font-size:15px;display:inline-block;">Vai su fantapronostic.com</a>
            </div>
            <p style="color:#8A96AE;font-size:13px;line-height:1.5;">Scarica l'app su <a href="https://apps.apple.com/it/app/fantapronostic/id6760613936" style="color:#1E4FD8;">App Store</a> o <a href="https://play.google.com/store/apps/details?id=com.fantapronostic.app" style="color:#1E4FD8;">Google Play</a>.</p>
          </div>
          <p style="text-align:center;color:#8A96AE;font-size:12px;margin-top:20px;">FantaPronostic — Il gioco dei pronostici tra amici.</p>
        </div>
        """,
    )


def _admin_notify_html(email: str, language: str, source: str, total_subs: int) -> str:
    return f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:30px 20px;">
      <h2 style="color:#1E4FD8;margin-top:0;">🎉 Nuovo iscritto alla newsletter</h2>
      <div style="background:#F6F9FE;border-radius:12px;padding:20px;border:1px solid #E4EAF4;">
        <p style="margin:0 0 10px;color:#0B1833;font-size:16px;"><strong>Email:</strong> {email}</p>
        <p style="margin:0 0 10px;color:#5B6B88;"><strong>Lingua:</strong> {language}</p>
        <p style="margin:0 0 10px;color:#5B6B88;"><strong>Sorgente:</strong> {source}</p>
        <p style="margin:0;color:#5B6B88;"><strong>Iscritto il:</strong> {datetime.now(timezone.utc).strftime('%d/%m/%Y %H:%M UTC')}</p>
      </div>
      <p style="color:#5B6B88;margin-top:20px;">Totale iscritti: <strong>{total_subs}</strong></p>
      <p style="color:#8A96AE;font-size:12px;margin-top:30px;">Notifica automatica · FantaPronostic newsletter system</p>
    </div>
    """


@newsletter_router.post("/subscribe")
async def subscribe(req: SubscribeRequest):
    """Subscribe an email to the FantaPronostic newsletter."""
    email = req.email.lower().strip()
    language = (req.language or "it")[:5]
    source = (req.source or "landing")[:50]

    existing = await newsletter_col.find_one({"email": email}, {"_id": 0})
    is_new = existing is None

    if is_new:
        await newsletter_col.insert_one(
            {
                "email": email,
                "language": language,
                "source": source,
                "subscribed_at": datetime.now(timezone.utc),
                "active": True,
            }
        )
        logger.info(f"[NEWSLETTER] New subscriber: {email[:5]}*** ({language}, {source})")
    else:
        # Re-subscription: reactivate if previously unsubscribed
        await newsletter_col.update_one(
            {"email": email},
            {"$set": {"active": True, "language": language, "last_subscribed_at": datetime.now(timezone.utc)}},
        )
        logger.info(f"[NEWSLETTER] Re-subscription: {email[:5]}*** ({language})")

    # Fire-and-forget emails (do not break flow if SendGrid fails)
    try:
        subject, html = _welcome_html(language)
        _send_via_sendgrid(email, subject, html)
    except Exception as e:
        logger.error(f"[NEWSLETTER] Welcome email error: {e}")

    if is_new:
        try:
            total = await newsletter_col.count_documents({"active": True})
            admin_html = _admin_notify_html(email, language, source, total)
            _send_via_sendgrid(
                ADMIN_NOTIFY_EMAIL,
                f"🎉 Nuovo iscritto newsletter — {email}",
                admin_html,
            )
        except Exception as e:
            logger.error(f"[NEWSLETTER] Admin notify email error: {e}")

    return {"ok": True, "already_subscribed": not is_new}

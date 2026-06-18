"""Export newsletter subscribers list and send it as CSV to the admin via email.

Run from /app/backend:
    python scripts/export_newsletter.py

Sends a CSV attachment with all active subscribers to NEWSLETTER_ADMIN_EMAIL
(default: info@fantapronostic.com).
"""
import os
import sys
import csv
import io
import asyncio
import base64
from datetime import datetime, timezone
from pathlib import Path

# Make 'backend' importable
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv

load_dotenv(BACKEND_DIR / ".env")

from database import db  # noqa: E402

ADMIN_EMAIL = os.environ.get("NEWSLETTER_ADMIN_EMAIL", "info@fantapronostic.com")
SENDER_EMAIL = os.environ.get("NEWSLETTER_SENDER_EMAIL", "info@fantapronostic.com")
SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY", "")


async def build_csv() -> tuple[str, int]:
    """Return (csv_string, total_subscribers)."""
    col = db.newsletter_subscribers
    cursor = col.find({"active": True}, {"_id": 0}).sort("subscribed_at", 1)
    rows = []
    async for doc in cursor:
        rows.append(doc)

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["email", "language", "source", "subscribed_at"])
    for r in rows:
        sub_at = r.get("subscribed_at")
        if isinstance(sub_at, datetime):
            sub_at = sub_at.strftime("%Y-%m-%d %H:%M:%S UTC")
        writer.writerow(
            [r.get("email", ""), r.get("language", ""), r.get("source", ""), sub_at or ""]
        )
    return buf.getvalue(), len(rows)


def send_csv(csv_str: str, total: int):
    if not SENDGRID_API_KEY:
        print("[ERROR] SENDGRID_API_KEY not set in /app/backend/.env")
        return False

    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import (
        Mail,
        Attachment,
        FileContent,
        FileName,
        FileType,
        Disposition,
    )

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    filename = f"fantapronostic_newsletter_{today}.csv"

    html = f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:30px 20px;">
      <h2 style="color:#1E4FD8;margin-top:0;">📋 Lista iscritti newsletter</h2>
      <div style="background:#F6F9FE;border-radius:12px;padding:20px;border:1px solid #E4EAF4;">
        <p style="margin:0 0 10px;color:#0B1833;font-size:16px;">Esportazione del <strong>{today}</strong></p>
        <p style="margin:0;color:#5B6B88;">Totale iscritti attivi: <strong style="color:#F58220;font-size:18px;">{total}</strong></p>
      </div>
      <p style="color:#5B6B88;margin-top:20px;">Il file CSV completo è in allegato.</p>
      <p style="color:#8A96AE;font-size:12px;margin-top:30px;">Export automatico · FantaPronostic newsletter system</p>
    </div>
    """

    encoded = base64.b64encode(csv_str.encode("utf-8")).decode("utf-8")
    attachment = Attachment(
        FileContent(encoded),
        FileName(filename),
        FileType("text/csv"),
        Disposition("attachment"),
    )

    message = Mail(
        from_email=SENDER_EMAIL,
        to_emails=ADMIN_EMAIL,
        subject=f"📋 Newsletter FantaPronostic — {total} iscritti ({today})",
        html_content=html,
    )
    message.attachment = attachment

    sg = SendGridAPIClient(SENDGRID_API_KEY)
    response = sg.send(message)
    return response.status_code == 202


async def main():
    csv_str, total = await build_csv()
    print(f"[INFO] {total} active subscribers loaded from MongoDB")
    if total == 0:
        print("[INFO] No subscribers yet, sending empty CSV anyway.")
    ok = send_csv(csv_str, total)
    if ok:
        print(f"[OK] CSV inviato a {ADMIN_EMAIL}")
    else:
        print("[ERROR] Invio fallito")


if __name__ == "__main__":
    asyncio.run(main())

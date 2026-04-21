import { useState, FormEvent } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Send, Check } from "lucide-react";

export function Contact() {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sent, setSent] = useState(false);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setForm({ name: "", email: "", message: "" });
    }, 3000);
  };

  return (
    <section
      id="contact"
      className="relative section-pad"
      data-testid="contact-section"
    >
      <div className="container-x">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-5"
          >
            <span className="overline">{t("contact.overline")}</span>
            <h2 className="font-display font-bold text-4xl md:text-5xl mt-4 tracking-tightest text-ink leading-[1.05]">
              {t("contact.title")}
            </h2>
            <p className="mt-5 text-muted text-base md:text-lg leading-relaxed max-w-md">
              {t("contact.subtitle")}
            </p>

            <div className="mt-10 space-y-4 text-sm">
              <div className="flex items-center gap-3">
                <span className="h-9 w-9 rounded-full bg-brand-orange-50 grid place-items-center text-brand-orange font-bold">
                  @
                </span>
                <a
                  href="mailto:support@fantapronostic.com"
                  className="text-ink2 font-medium hover:text-brand-blue transition-colors"
                >
                  support@fantapronostic.com
                </a>
              </div>
            </div>
          </motion.div>

          <motion.form
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: 0.1 }}
            onSubmit={onSubmit}
            className="lg:col-span-7 card p-6 md:p-10 flex flex-col gap-4"
            data-testid="contact-form"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label={t("contact.name")}
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
                testid="contact-input-name"
              />
              <Field
                label={t("contact.email")}
                type="email"
                value={form.email}
                onChange={(v) => setForm({ ...form, email: v })}
                testid="contact-input-email"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-muted font-bold mb-2 block">
                {t("contact.message")}
              </label>
              <textarea
                required
                rows={5}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="w-full rounded-2xl border border-line bg-bg-soft px-5 py-4 text-ink placeholder:text-muted focus:outline-none focus:border-brand-blue focus:bg-white transition-colors resize-none"
                data-testid="contact-input-message"
              />
            </div>
            <button
              type="submit"
              className="btn-primary self-start"
              data-testid="contact-submit"
            >
              {sent ? (
                <>
                  <Check size={18} />
                  {t("contact.success")}
                </>
              ) : (
                <>
                  <Send size={16} />
                  {t("contact.cta")}
                </>
              )}
            </button>
          </motion.form>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  testid,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  testid: string;
}) {
  return (
    <div>
      <label className="text-xs uppercase tracking-widest text-muted font-bold mb-2 block">
        {label}
      </label>
      <input
        required
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-line bg-bg-soft px-5 py-3.5 text-ink placeholder:text-muted focus:outline-none focus:border-brand-blue focus:bg-white transition-colors"
        data-testid={testid}
      />
    </div>
  );
}

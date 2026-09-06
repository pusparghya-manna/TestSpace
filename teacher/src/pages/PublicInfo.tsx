import { useEffect } from 'react';
import { Link } from 'react-router-dom';

export function PageMeta() {
  const path = window.location.pathname;
  const meta: Record<string, { title: string; description: string }> = {
    '/login': {
      title: 'Teacher Login | TestSpace',
      description: 'Sign in or register to manage exams, students, results, and Telegram quiz workflows.',
    },
    '/privacy': {
      title: 'Privacy Policy | TestSpace',
      description: 'Learn how TestSpace handles account, exam, Telegram, and browser storage data.',
    },
    '/terms': {
      title: 'Terms of Service | TestSpace',
      description: 'Read the terms for using the TestSpace teacher dashboard and Telegram quiz service.',
    },
    '/contact': {
      title: 'Contact | TestSpace',
      description: 'Contact TestSpace for support, questions, and service enquiries.',
    },
    '/thank-you': {
      title: 'Thank You | TestSpace',
      description: 'Your action was completed successfully in TestSpace.',
    },
  };
  const current = meta[path] || {
    title: 'TestSpace | Teacher Dashboard',
    description: 'Manage exams, students, results, and Telegram quiz workflows with TestSpace.',
  };
  useEffect(() => {
    document.title = current.title;
    let tag = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!tag) { tag = document.createElement('meta'); tag.name = 'description'; document.head.appendChild(tag); }
    tag.content = current.description;
    const canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (canonical) canonical.href = `https://quizbot.testspace.de5.net${path}`;
  }, [current.description, current.title, path]);
  return null;
}

function PublicShell({ title, children, legal = false }: { title: string; children: React.ReactNode; legal?: boolean }) {
  return (
    <main className="public-page min-h-[100dvh] overflow-y-auto px-3 py-4 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-lg sm:max-w-2xl">
        <Link to="/login" className="public-back-link">← Back to sign in</Link>
        <article className={`public-card mt-3 sm:mt-5 ${legal ? 'legal-card' : ''}`}>
          <div className="public-card-heading">
            <img src="/logo.svg" alt="TestSpace" className="public-brand-logo" />
            <div>
              <p className="public-eyebrow">TestSpace</p>
              <h1 className="public-title">{title}</h1>
            </div>
          </div>
          {children}
        </article>
      </div>
    </main>
  );
}

function LegalSection({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <section className="legal-section">
      <div className="legal-section-number">{number}</div>
      <div>
        <h2>{title}</h2>
        <div className="legal-section-copy">{children}</div>
      </div>
    </section>
  );
}

export function PrivacyPage() {
  return (
    <PublicShell title="Privacy Policy" legal>
      <div className="legal-intro">
        <p>We respect your privacy and aim to keep our data practices clear. This policy explains how TestSpace handles information when you use the teacher dashboard or Telegram quiz experience.</p>
        <span>Last updated: September 2, 2026</span>
      </div>
      <div className="legal-sections">
        <LegalSection number="01" title="The service"><p>TestSpace provides a teacher dashboard and a Telegram quiz experience for creating exams, managing students, and reviewing results.</p></LegalSection>
        <LegalSection number="02" title="Information we use"><p>Depending on how you use the service, we may process your account username, display name, authentication information, exam content, student submissions, results, audit activity, and operational settings. When you open the Mini App through Telegram, Telegram may provide launch information needed to authenticate the session.</p></LegalSection>
        <LegalSection number="03" title="Browser storage"><p>The applications use localStorage and sessionStorage for authentication tokens, drafts, notification state, and Mini App caching. These are functional browser-storage technologies used to operate the service. We do not currently use analytics cookies or third-party advertising cookies.</p></LegalSection>
        <LegalSection number="04" title="Retention and security"><p>We retain information for as long as needed to provide the service, maintain records, resolve issues, and meet applicable obligations. We use reasonable technical and organizational measures to protect information, but no internet service can guarantee absolute security.</p></LegalSection>
        <LegalSection number="05" title="Questions"><p>For privacy questions or requests, contact <a href="mailto:testspacemanna26@gmail.com">testspacemanna26@gmail.com</a> or message <a href="https://t.me/testspacemanna">@testspacemanna</a> on Telegram.</p></LegalSection>
      </div>
    </PublicShell>
  );
}

export function TermsPage() {
  return (
    <PublicShell title="Terms of Service" legal>
      <div className="legal-intro">
        <p>These terms set out the basic expectations for using the TestSpace teacher dashboard and Telegram quiz service.</p>
        <span>Last updated: September 2, 2026</span>
      </div>
      <div className="legal-sections">
        <LegalSection number="01" title="Acceptance"><p>By using TestSpace, you agree to use the teacher dashboard and Telegram quiz service responsibly and in accordance with applicable law.</p></LegalSection>
        <LegalSection number="02" title="Accounts"><p>You are responsible for keeping your account credentials secure and for all activity performed through your account. Do not share credentials or use another person’s account without permission.</p></LegalSection>
        <LegalSection number="03" title="Content and student information"><p>Teachers are responsible for ensuring that exam content, uploaded material, and student information may lawfully be used and shared through the service. Do not upload content that is unlawful, harmful, infringing, or unrelated to the service.</p></LegalSection>
        <LegalSection number="04" title="Service availability"><p>We work to keep the service useful and available, but features may change and temporary interruptions may occur for maintenance, security, infrastructure, or circumstances outside our control.</p></LegalSection>
        <LegalSection number="05" title="Responsible use"><p>You must not attempt to disrupt the service, bypass authentication, access data that is not yours, or use the service to harm others. We may restrict access when necessary to protect the service and its users.</p></LegalSection>
        <LegalSection number="06" title="Contact"><p>Questions about these terms can be sent to <a href="mailto:testspacemanna26@gmail.com">testspacemanna26@gmail.com</a> or via <a href="https://t.me/testspacemanna">@testspacemanna</a>.</p></LegalSection>
      </div>
    </PublicShell>
  );
}

export function ContactPage() {
  return (
    <PublicShell title="Contact">
      <p className="public-lead">We are happy to help with access, exams, results, and service questions.</p>
      <div className="contact-grid">
        <a href="mailto:testspacemanna26@gmail.com" className="contact-card contact-card-primary"><span>Email</span><strong>testspacemanna26@gmail.com</strong></a>
        <a href="https://t.me/testspacemanna" className="contact-card"><span>Telegram support</span><strong>@testspacemanna</strong></a>
      </div>
      <p className="contact-note">When contacting support, include the page or feature you were using and a short description of the issue. Please do not send passwords or private student information by email or Telegram.</p>
    </PublicShell>
  );
}

export function ThankYouPage() {
  return <PublicShell title="Thank you"><div className="mt-6 rounded-2xl bg-blue-50 p-6 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-2xl font-black text-white">✓</div><h2 className="mt-4 text-xl font-bold text-slate-900">Your action was completed</h2><p className="mt-2 text-sm text-slate-600">Continue to the teacher dashboard or open the student experience through Telegram.</p><div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center"><Link to="/login" className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700">Teacher login / Register</Link><a href="https://t.me/testspace_bot" className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-blue-700 ring-1 ring-blue-200 hover:bg-blue-100">Open TestSpace</a></div></div></PublicShell>;
}

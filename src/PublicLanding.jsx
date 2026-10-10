import React, { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChartNoAxesCombined, Check, ChevronDown, LogIn, MessageCircle, ShieldCheck, Target, Wallet } from "lucide-react";
import "./PublicLanding.css";

const features = [
  { id:"wallet", label:"Wallets", icon:Wallet, title:"Money in different places. Records all together.", copy:"Keep track of bank accounts, e-wallets, and cash in one place. Record transfers and reconcile your balances with the money you actually have.", image:"wallet.png" },
  { id:"budget", label:"Budget", icon:Target, title:"Give every spending category a clear limit.", copy:"Plan your allocations, see actual spending from your transactions, and check the details. Know when you have room and when to slow down.", image:"budget.png" },
  { id:"reports", label:"Reports", icon:ChartNoAxesCombined, title:"More than numbers. The story behind your money.", copy:"Review income, spending, and financial progress by period. Export your report to PDF for a closer look whenever you need it.", image:"reports.png" },
];
const examples = [
  { question:"Help me start managing my money.", answer:"Of course. Let's start with the money you actually have.", points:["Add your opening bank and cash balances in Wallets.","Record your income and expenses.","Set limits in Budget, then look at your spending patterns."] },
  { question:"Record Rp 25,000 for lunch from cash.", answer:"Here's how your message can be read. Check the wallet and category before asking to record it.", details:[["Type","Expense"],["Amount","Rp 25,000"],["Wallet","Cash"],["Category","Food & Drinks"]] },
  { question:"What can I review this month?", answer:"Start with these three areas. AI analysis in the app uses the records available in your account.", points:["Cashflow: how much came in and went out?","Budget: which categories need attention?","Saving rate: how much of your income did you set aside?"] },
];

export default function PublicLanding() {
  const [selected, setSelected] = useState(0);
  const [example, setExample] = useState(0);
  const root = useRef(null);
  useEffect(() => {
    const previousLanguage = document.documentElement.lang;
    document.documentElement.lang = "en";
    document.body.classList.add("atur-public-page");
    return () => {
      document.documentElement.lang = previousLanguage;
      document.body.classList.remove("atur-public-page");
    };
  }, []);
  useEffect(() => {
    const nodes = root.current?.querySelectorAll("[data-reveal]") || [];
    if (!window.IntersectionObserver) return;
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add("is-visible"); observer.unobserve(entry.target); }
    }), { threshold:0.12 });
    nodes.forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, []);
  const current = features[selected];
  return <div className="public-site" ref={root} lang="en">
    <a className="public-skip" href="#public-main">Skip to content</a>
    <header className="public-header">
      <a className="public-brand" href="#home" aria-label="AturDuitku, home"><img src="/icon-192.png" alt="" width="40" height="40"/><span>AturDuitku</span></a>
      <nav aria-label="Public page navigation"><a href="#dokter-keuangan">Meet your AI</a><a href="#fitur">Inside the app</a><a href="#pertanyaan">Questions</a></nav>
      <a className="public-login" href="#login"><LogIn size={17}/> Log in</a>
    </header>
    <main id="public-main">
      <section className="public-hero" aria-labelledby="public-title">
        <div className="public-hero-copy">
          <p className="public-kicker">Your money has a story. Let's make sense of it.</p>
          <h1 id="public-title">AturDuitku</h1>
          <h2>Your <span className="public-ai-word">AI</span> companion<br/>for everyday money.</h2>
          <p>Where did it go? What's left? Track your money, plan your budget, and chat with <strong>Dokter Keuangan AI</strong> to understand the patterns.</p>
          <div className="public-actions"><a className="public-primary" href="#login">Start managing your money <LogIn size={19}/></a><a className="public-text-link" href="#dokter-keuangan">Meet your AI <ChevronDown size={17}/></a></div>
          <span className="public-device-note">Phone or laptop. One account, the same records.</span>
        </div>
        <div className="public-hero-scene">
          <div className="public-mascot-greeting"><span>Hi! I'm Dokter Keuangan.</span><strong>Your AI friend<br/>for money talk.</strong></div>
          <img className="public-mascot" src="/landing/mascot.png" alt="Dokter Keuangan cat mascot pointing to the AturDuitku app" width="280" height="280"/>
          <div className="public-hero-product">
          <picture><source media="(max-width: 600px)" srcSet="/landing/mobile-home.png"/><img src="/landing/home.png" alt="AturDuitku dashboard showing a daily spending limit, balance, and financial overview with sample data" width="1280" height="900" fetchPriority="high"/></picture>
          </div>
        </div>
        <p className="public-demo-note">App screenshots use sample data, not customer records.</p>
      </section>
      <section className="public-ai public-container" id="dokter-keuangan" aria-labelledby="ai-title" data-reveal>
        <div className="public-ai-heading"><p className="public-kicker">Let's get acquainted.</p><h2 id="ai-title">Dokter Keuangan.<br/><span>Talk money with your AI.</span></h2><p>No formulas needed to start understanding your money. Ask about your records, get help logging transactions, or find a small next step for this month.</p></div>
        <div className="public-ai-layout">
          <div className="public-ai-capabilities">
            <p className="public-ai-intro">Type like you're talking to a friend.<br/><strong>AI helps make sense of your request.</strong></p>
            <article><MessageCircle/><h3>A conversation with context.</h3><p>Discuss cashflow, budget usage, and saving rate using the records available in your account, not just generic answers.</p></article>
            <article><Wallet/><h3>Everyday words, help with records.</h3><p>Name the transaction, amount, and wallet. Dokter Keuangan AI helps with supported recording actions when you clearly ask it to.</p></article>
            <article><ShieldCheck/><h3>You stay in charge.</h3><p>Unclear details need clarification. Check recorded results and edit if needed; asking a question or running a simulation is not a request to change your data.</p></article>
          </div>
          <div className="public-ai-demo">
            <div className="public-ai-demo-header"><img src="/icon-192.png" width="42" height="42" alt=""/><div><strong>Dokter Keuangan AI</strong><span>Sample conversation, not an analysis of your account</span></div></div>
            <div className="public-prompts" aria-label="Choose a sample conversation">{["Where to start?","Help me record","Review my money"].map((label,index)=><button key={label} aria-pressed={example===index} onClick={()=>setExample(index)}>{label}</button>)}</div>
            <div className="public-conversation" aria-live="polite" aria-atomic="true">
              <div className="public-question">{examples[example].question}</div>
              <div className="public-answer" key={example}><p>{examples[example].answer}</p>
                {examples[example].points && <ul>{examples[example].points.map(point=><li key={point}><Check size={16}/><span>{point}</span></li>)}</ul>}
                {examples[example].details && <dl className="public-demo-transaction">{examples[example].details.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
              </div>
            </div>
            <p className="public-example-note">Feature simulation. No transactions are recorded or balances changed.</p>
          </div>
        </div><p className="public-ai-disclaimer">AI can make mistakes. Analysis depends on how complete your records are. Dokter Keuangan is a helpful tool, not a substitute for professional financial advice.</p>
      </section>
      <section className="public-intro public-container" data-reveal>
        <p className="public-kicker">Give your money somewhere to go.</p>
        <h2>Enjoy payday.<br/>Keep a plan for month-end.</h2>
        <p>Start with simple records. Then see the bigger picture: today's needs, the goals you're working toward, and room for your future. Small steps count, too.</p>
      </section>
      <section className="public-feature-section" id="fitur" aria-labelledby="features-title">
        <div className="public-container" data-reveal>
          <div className="public-section-heading"><div><p className="public-kicker">Inside AturDuitku</p><h2 id="features-title">Your records, connected.</h2></div><p>From wallet balances to reports.<br/>No jumping between spreadsheets.</p></div>
          <div className="public-tabs" role="tablist" aria-label="Explore app features">{features.map((feature, index) => <button key={feature.id} id={`tab-${feature.id}`} role="tab" aria-selected={selected===index} aria-controls="public-feature-panel" tabIndex={selected===index?0:-1} onClick={()=>setSelected(index)} onKeyDown={event=>{if(["ArrowLeft","ArrowRight","Home","End"].includes(event.key)){event.preventDefault();const next=event.key==="Home"?0:event.key==="End"?features.length-1:(index+(event.key==="ArrowRight"?1:-1)+features.length)%features.length;setSelected(next);event.currentTarget.parentElement.children[next].focus();}}}><feature.icon size={18}/>{feature.label}</button>)}</div>
          <div id="public-feature-panel" role="tabpanel" aria-labelledby={`tab-${current.id}`} className="public-feature-panel"><div className="public-feature-copy"><h3>{current.title}</h3><p>{current.copy}</p><a className="public-text-link" href="#login">Open AturDuitku <ArrowUpRight size={17}/></a></div><img key={current.image} src={`/landing/${current.image}`} alt={`AturDuitku ${current.label} screen with sample data`} loading="lazy" width="1280" height="900"/></div>
          <div className="public-extra-features"><p><Check size={18}/> Goals for your savings targets</p><p><Check size={18}/> Envelopes for planned funds</p><p><Check size={18}/> Debts, receivables, and due dates</p><p><Check size={18}/> Habits that keep you consistent</p></div>
        </div>
      </section>
      <section className="public-faq" id="pertanyaan"><div className="public-container" data-reveal><div><p className="public-kicker">Before you begin</p><h2>A few things<br/>worth knowing.</h2></div><div>{[
        ["What can the AI help with?","Dokter Keuangan AI helps review cashflow, budgets, and saving rate using your available records, and assists with recording through conversation. Give clear details and check the results. AI can make mistakes; this is not a professional financial advisory service."],
        ["Already have an account? Where do I log in?","Click Log in at the top right. You'll reach the same AturDuitku login screen, with Google or email. Use the account and sign-in method you used before."],
        ["Do I need to install an app first?","No. Open AturDuitku in a browser on your phone or laptop. You can also add it to your home screen using the available PWA installation option."],
        ["Are bank accounts connected automatically?","Wallets track the balances of your bank accounts, e-wallets, and cash. Record transactions yourself or use the bank-statement import feature; this is not an automatic connection to your bank."],
        ["How do new accounts get access?","Create an account through the login screen. Full access follows payment verification and admin approval. Contact support if you need help activating your account."],
      ].map(([question,answer])=><details key={question}><summary>{question}<ChevronDown size={19}/></summary><p>{answer}</p></details>)}</div></div></section>
      <section className="public-closing public-container" data-reveal><img src="/icon-192.png" alt="" width="64" height="64"/><h2>Start with what you have.<br/>Build habits that last.</h2><p>Your money doesn't have to be perfectly organized before you begin.</p><a className="public-primary" href="#login">Log in to AturDuitku <LogIn size={18}/></a></section>
    </main>
    <footer className="public-footer public-container"><a className="public-brand" href="#home"><img src="/icon-192.png" alt="" width="32" height="32"/>AturDuitku</a><p>Track your money. Understand it. Build better habits.</p><a href="https://wa.me/6287785472696" target="_blank" rel="noreferrer">Contact support <ArrowUpRight size={15}/></a><span>© 2025 AturDuitku</span></footer>
  </div>;
}

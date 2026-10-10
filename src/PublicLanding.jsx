import React, { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChartNoAxesCombined, Check, ChevronDown, LogIn, MessageCircle, ShieldCheck, Target, Wallet } from "lucide-react";
import "./PublicLanding.css";

const features = [
  { id:"wallet", label:"Wallets", icon:Wallet, title:"Several wallets. One clearer picture.", copy:"Bank account, e-wallet, or cash? Keep their balances in one place. Record transfers between wallets without confusing them with everyday spending, and reconcile your records with the money you actually have.", image:"wallet.png" },
  { id:"budget", label:"Budget", icon:Target, title:"A budget you can check, not just set.", copy:"Give food, transport, and other needs a limit. See recorded spending against each allocation, open the transaction details, and spot categories that need attention before planning your next purchase.", image:"budget.png" },
  { id:"reports", label:"Reports", icon:ChartNoAxesCombined, title:"Find the pattern behind your spending.", copy:"Review income and expenses for the period you choose, see where your money went, and track progress over time. Export a PDF when you want a closer look. Your records also give Dokter Keuangan AI context for the conversation.", image:"reports.png" },
];
const examples = [
  { label:"Where did it go?", icon:ChartNoAxesCombined, pain:"Payday came. Where did my money go?", help:"Ask AI to review your cashflow and budget usage, then turn the patterns in your records into something you can act on.", question:"Help me understand where my money went this month.", answer:"Let's look at the month, not guess from today's balance. With your records, I can help you review:", points:["Income versus spending: what came in, and what went out.","Budget usage: which categories are taking the most room.","Next steps: what to review before planning the rest of the month."] },
  { label:"Help me record", icon:MessageCircle, pain:"I want to track it. I keep putting it off.", help:"Tell AI the amount, wallet, and what it was for. Get help recording everyday transactions in the words you already use.",
    question:"Record Rp 25,000 for lunch from cash.", answer:"Here's how your message can be read. Check the wallet and category before asking to record it.", details:[["Type","Expense"],["Amount","Rp 25,000"],["Wallet","Cash"],["Category","Food & Drinks"]] },
  { label:"Plan my savings", icon:Target, pain:"I want to save. What's realistic for me?", help:"Discuss a savings target using your balances and cashflow. AI can help break a big intention into smaller, more realistic steps.", question:"Help me make a savings plan that fits my money.", answer:"A useful plan needs room for real life. We can work through these together using your available records:", points:["Review your income, expenses, and existing commitments.","Choose a goal and timeframe you want to work toward.","Discuss a contribution you can revisit as your cashflow changes."] },
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
      <nav aria-label="Public page navigation"><a href="#dokter-keuangan">Your AI money companion</a><a href="#fitur">Inside the app</a><a href="#pertanyaan">Questions</a></nav>
      <a className="public-login" href="#login"><LogIn size={17}/> Log in</a>
    </header>
    <main id="public-main">
      <section className="public-hero" aria-labelledby="public-title">
        <div className="public-hero-copy">
          <h1 id="public-title">AturDuitku</h1>
          <h2>Money feels messy?<br/>Make sense of it with <span className="public-ai-word">AI.</span></h2>
          <p>Money goes out. Questions pile up. Track your personal finances and talk to <strong>Dokter Keuangan AI</strong> about your spending, budget, and next savings goal.</p>
          <div className="public-actions"><a className="public-primary" href="#login">Take control of my money <LogIn size={19}/></a><a className="public-text-link" href="#dokter-keuangan">See how AI helps <ChevronDown size={17}/></a></div>
          <span className="public-device-note">Your records. Your questions. One place to work through them.</span>
        </div>
        <div className="public-hero-scene">
          <div className="public-mascot-greeting"><span>Ask Dokter Keuangan AI</span><strong>"Where did<br/>my money go?"</strong><span>Let's look at your records.</span></div>
          <img className="public-mascot" src="/landing/mascot.png" alt="Dokter Keuangan cat mascot pointing to the AturDuitku app" width="280" height="280"/>
          <div className="public-hero-product">
          <picture><source media="(max-width: 600px)" srcSet="/landing/mobile-home.png"/><img src="/landing/home.png" alt="AturDuitku dashboard showing a daily spending limit, balance, and financial overview with sample data" width="1280" height="900" fetchPriority="high"/></picture>
          </div>
        </div>
        <p className="public-demo-note">App screenshots use sample data, not customer records.</p>
      </section>
      <section className="public-ai public-container" id="dokter-keuangan" aria-labelledby="ai-title" data-reveal>
        <div className="public-ai-heading"><h2 id="ai-title">Meet your AI money companion.<br/><span>Dokter Keuangan.</span></h2><p>Not sure what the numbers mean? Start with a question. AI uses your available records to help you understand the situation and think through a practical next step.</p></div>
        <div className="public-ai-layout">
          <div className="public-ai-capabilities">
            <div className="public-pain-options" aria-label="Choose the money problem you relate to">{examples.map((item,index)=><button key={item.label} className="public-pain-option" aria-pressed={example===index} aria-controls="public-ai-conversation" onClick={()=>setExample(index)}><item.icon size={23}/><span><strong>{item.pain}</strong><span>{item.help}</span></span></button>)}</div>
            <div className="public-ai-control"><ShieldCheck size={20}/><p><strong>Your money. Your decisions.</strong> Ask questions without changing your records. Give clear instructions when you want help recording, and check the result.</p></div>
          </div>
          <div className="public-ai-demo">
            <div className="public-ai-demo-header"><img src="/icon-192.png" width="42" height="42" alt=""/><div><strong>Dokter Keuangan AI</strong><span>Sample conversation, not an analysis of your account</span></div></div>
            <div className="public-prompts" aria-label="Choose a sample conversation">{examples.map((item,index)=><button key={item.label} aria-pressed={example===index} aria-controls="public-ai-conversation" onClick={()=>setExample(index)}>{item.label}</button>)}</div>
            <div className="public-conversation" id="public-ai-conversation" aria-live="polite" aria-atomic="true">
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
        <div><h2>Less spreadsheet detective work.<br/><span>More knowing what's next.</span></h2><p>You don't need to be good with numbers to start. Bring your records together, then ask AI to help you make sense of them.</p></div>
        <ul className="public-connected-benefits"><li><Wallet size={22}/><div><strong>Know what you actually have.</strong><p>See cash, bank, and e-wallet balances together.</p></div></li><li><Target size={22}/><div><strong>Make room for the things that matter.</strong><p>Give everyday needs a budget and future plans a goal.</p></div></li><li><MessageCircle size={22}/><div><strong>Don't get stuck at the numbers.</strong><p>Talk to AI about patterns and possible next steps.</p></div></li></ul>
      </section>
      <section className="public-feature-section" id="fitur" aria-labelledby="features-title">
        <div className="public-container" data-reveal>
          <div className="public-section-heading"><div><h2 id="features-title">The tools behind<br/>a clearer money conversation.</h2></div><p>Records you can see.<br/>Context your AI can use.</p></div>
          <div className="public-tabs" role="tablist" aria-label="Explore app features">{features.map((feature, index) => <button key={feature.id} id={`tab-${feature.id}`} role="tab" aria-selected={selected===index} aria-controls="public-feature-panel" tabIndex={selected===index?0:-1} onClick={()=>setSelected(index)} onKeyDown={event=>{if(["ArrowLeft","ArrowRight","Home","End"].includes(event.key)){event.preventDefault();const next=event.key==="Home"?0:event.key==="End"?features.length-1:(index+(event.key==="ArrowRight"?1:-1)+features.length)%features.length;setSelected(next);event.currentTarget.parentElement.children[next].focus();}}}><feature.icon size={18}/>{feature.label}</button>)}</div>
          <div id="public-feature-panel" role="tabpanel" aria-labelledby={`tab-${current.id}`} className="public-feature-panel"><div className="public-feature-copy"><h3>{current.title}</h3><p>{current.copy}</p><a className="public-text-link" href="#login">Open AturDuitku <ArrowUpRight size={17}/></a></div><img key={current.image} src={`/landing/${current.image}`} alt={`AturDuitku ${current.label} screen with sample data`} loading="lazy" width="1280" height="900"/></div>
          <div className="public-extra-features"><p><Check size={18}/> Goals for your savings targets</p><p><Check size={18}/> Envelopes for planned funds</p><p><Check size={18}/> Debts, receivables, and due dates</p><p><Check size={18}/> Habits that keep you consistent</p></div>
        </div>
      </section>
      <section className="public-faq" id="pertanyaan"><div className="public-container" data-reveal><div><h2>Good questions.<br/>Clear answers.</h2></div><div>{[
        ["What can the AI help with?","Dokter Keuangan AI helps review cashflow, budgets, and saving rate using your available records, and assists with recording through conversation. Give clear details and check the results. AI can make mistakes; this is not a professional financial advisory service."],
        ["Already have an account? Where do I log in?","Click Log in at the top right. You'll reach the same AturDuitku login screen, with Google or email. Use the account and sign-in method you used before."],
        ["What if my records are incomplete?","Start with your current wallet balances and record from there. Dokter Keuangan AI can help explain the setup and what to add next. Its analysis depends on the records you provide; it cannot see spending that has not been recorded or imported."],
        ["Do I need to install an app first?","No. Open AturDuitku in a browser on your phone or laptop. You can also add it to your home screen using the available PWA installation option."],
        ["Are bank accounts connected automatically?","Wallets track the balances of your bank accounts, e-wallets, and cash. Record transactions yourself or use the bank-statement import feature; this is not an automatic connection to your bank."],
        ["How do new accounts get access?","Create an account through the login screen. Full access follows payment verification and admin approval. Contact support if you need help activating your account."],
      ].map(([question,answer])=><details key={question}><summary>{question}<ChevronDown size={19}/></summary><p>{answer}</p></details>)}</div></div></section>
      <section className="public-closing public-container" data-reveal><img src="/icon-192.png" alt="" width="64" height="64"/><h2>You don't need a perfect plan.<br/>Just a clearer next step.</h2><p>Bring your money questions. Let Dokter Keuangan AI help you work through them.</p><a className="public-primary" href="#login">Open my money workspace <LogIn size={18}/></a></section>
    </main>
    <footer className="public-footer public-container"><a className="public-brand" href="#home"><img src="/icon-192.png" alt="" width="32" height="32"/>AturDuitku</a><p>Personal finance. Real records. A conversation with AI.</p><a href="https://wa.me/6287785472696" target="_blank" rel="noreferrer">Contact support <ArrowUpRight size={15}/></a><span>© 2025 AturDuitku</span></footer>
  </div>;
}

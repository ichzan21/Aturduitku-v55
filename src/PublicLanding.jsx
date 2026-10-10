import React, { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChartNoAxesCombined, Check, ChevronDown, LogIn, MessageCircle, ShieldCheck, Target, Wallet } from "lucide-react";
import "./PublicLanding.css";

const features = [
  { id:"wallet", label:"Wallets", icon:Wallet, title:"Check each wallet without switching apps.", copy:"Keep a record of your bank, e-wallet, and cash balances in one place. Track transfers separately from spending, open each wallet's history, and adjust your records when the actual balance differs.", image:"wallet.png" },
  { id:"budget", label:"Budget", icon:Target, title:"See how much of your monthly budget is left.", copy:"Set an allocation for food, transport, or another category. Compare it with recorded spending and open the transactions behind the total. Check what's left before you decide on your next purchase.", image:"budget.png" },
  { id:"reports", label:"Reports", icon:ChartNoAxesCombined, title:"Review spending for the dates you choose.", copy:"Compare income and expenses for a selected period, review spending by category, or export a PDF. Ask Dokter Keuangan AI about the patterns in your records when you want help planning what to do next.", image:"reports.png" },
];
const examples = [
  { label:"Where did it go?", icon:ChartNoAxesCombined, pain:"Payday came. Where did my money go?", help:"Ask Dokter Keuangan AI to review recorded income and spending. Discuss the categories using up your budget and what you could adjust for the rest of the month.", question:"Help me understand where my money went this month.", answer:"Start with this month's records. I can help you review:", points:["How recorded income compares with your spending.","Which categories have used the largest share of your budget.","What you could adjust before the next payday."] },
  { label:"Help me record", icon:MessageCircle, pain:"I want to track it. I keep putting it off.", help:"Tell AI the amount, wallet, and what it was for. Get help recording everyday transactions in the words you already use.",
    question:"Record Rp 25,000 for lunch from cash.", answer:"Here's how your message can be read. Check the wallet and category before asking to record it.", details:[["Type","Expense"],["Amount","Rp 25,000"],["Wallet","Cash"],["Category","Food & Drinks"]] },
  { label:"Plan my savings", icon:Target, pain:"I want to save. What's realistic for me?", help:"Tell AI what you're saving for. Review your recorded cashflow and commitments together, then discuss a contribution you can adjust as your situation changes.", question:"Help me make a savings plan that fits my money.", answer:"Let's work out what you can set aside without overlooking everyday needs:", points:["Review your recorded income, expenses, and commitments.","Choose a savings goal and timeframe.","Discuss a contribution to review when your cashflow changes."] },
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
      <nav aria-label="Public page navigation"><a href="#dokter-keuangan">Dokter Keuangan AI</a><a href="#fitur">Budget & expenses</a><a href="#pertanyaan">Questions</a></nav>
      <a className="public-login" href="#login"><LogIn size={17}/> Log in</a>
    </header>
    <main id="public-main">
      <section className="public-hero" aria-labelledby="public-title">
        <div className="public-hero-copy">
          <h1 id="public-title">AturDuitku</h1>
          <h2>Know where your money went.<br/>Plan what's next with <span className="public-ai-word">AI.</span></h2>
          <p>Track expenses and plan your monthly budget in AturDuitku. Ask <strong>Dokter Keuangan AI</strong> to help you review your spending and work out what you can set aside.</p>
          <div className="public-actions"><a className="public-primary" href="#login">Open AturDuitku <LogIn size={19}/></a><a className="public-text-link" href="#dokter-keuangan">See AI examples <ChevronDown size={17}/></a></div>
          <span className="public-device-note">A personal finance app for the money you record.</span>
        </div>
        <div className="public-hero-scene">
          <div className="public-mascot-greeting"><span>Ask Dokter Keuangan AI</span><strong>"Where did<br/>my money go?"</strong><span>Let's look at your records.</span></div>
          <img className="public-mascot" data-mascot="wave" src="/landing/mascot-wave.webp" alt="Dokter Keuangan cat mascot waving hello" width="512" height="512" fetchPriority="high"/>
          <div className="public-hero-product">
          <picture><source media="(max-width: 600px)" srcSet="/landing/mobile-home.png"/><img src="/landing/home.png" alt="AturDuitku dashboard showing a daily spending limit, balance, and financial overview with sample data" width="1280" height="900" fetchPriority="high"/></picture>
          </div>
        </div>
        <p className="public-demo-note">App screenshots use sample data, not customer records.</p>
      </section>
      <section className="public-ai public-container" id="dokter-keuangan" aria-labelledby="ai-title" data-reveal>
        <div className="public-ai-heading"><div><h2 id="ai-title">Ask your AI finance assistant.<br/><span>Dokter Keuangan.</span></h2><p>Wondering why your budget ran out, or how much you could save? Ask in your own words. Dokter Keuangan AI uses your available records to help you review the numbers and consider your next move.</p></div><img className="public-ai-mascot" data-mascot="think" src="/landing/mascot-think.webp" alt="Dokter Keuangan thinking while reviewing a tablet" width="512" height="512" loading="lazy" decoding="async"/></div>
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
        <div><div className="public-intro-title"><h2>Start with the money<br/><span>you have today.</span></h2><img className="public-saving-mascot" data-mascot="save" src="/landing/mascot-save.webp" alt="Dokter Keuangan putting a coin into a savings piggy bank" width="512" height="512" loading="lazy" decoding="async"/></div><p>Missed a few weeks of tracking? Add your current wallet balances and record from today. You can build the habit without filling in every forgotten purchase.</p></div>
        <ul className="public-connected-benefits"><li><Wallet size={22}/><div><strong>Keep your balances together.</strong><p>Record cash, bank, and e-wallet balances in one place.</p></div></li><li><Target size={22}/><div><strong>Give your savings a place in the plan.</strong><p>Set a budget for everyday needs and a goal for future purchases.</p></div></li><li><MessageCircle size={22}/><div><strong>Ask about the numbers you see.</strong><p>Discuss spending patterns and savings plans with AI.</p></div></li></ul>
      </section>
      <section className="public-feature-section" id="fitur" aria-labelledby="features-title">
        <div className="public-container" data-reveal>
          <div className="public-section-heading"><div><h2 id="features-title">Your expense tracker<br/>and monthly budget planner.</h2></div><div className="public-gallery-guide"><img data-mascot="guide" src="/landing/mascot-guide.webp" alt="Dokter Keuangan pointing toward the app features" width="512" height="512" loading="lazy" decoding="async"/><p>Review your records here.<br/>Ask AI about them.</p></div></div>
          <div className="public-tabs" role="tablist" aria-label="Explore app features">{features.map((feature, index) => <button key={feature.id} id={`tab-${feature.id}`} role="tab" aria-selected={selected===index} aria-controls="public-feature-panel" tabIndex={selected===index?0:-1} onClick={()=>setSelected(index)} onKeyDown={event=>{if(["ArrowLeft","ArrowRight","Home","End"].includes(event.key)){event.preventDefault();const next=event.key==="Home"?0:event.key==="End"?features.length-1:(index+(event.key==="ArrowRight"?1:-1)+features.length)%features.length;setSelected(next);event.currentTarget.parentElement.children[next].focus();}}}><feature.icon size={18}/>{feature.label}</button>)}</div>
          <div id="public-feature-panel" role="tabpanel" aria-labelledby={`tab-${current.id}`} className="public-feature-panel"><div className="public-feature-copy"><h3>{current.title}</h3><p>{current.copy}</p><a className="public-text-link" href="#login">Open AturDuitku <ArrowUpRight size={17}/></a></div><img key={current.image} src={`/landing/${current.image}`} alt={`AturDuitku ${current.label} screen with sample data`} loading="lazy" width="1280" height="900"/></div>
          <div className="public-extra-features"><p><Check size={18}/> Goals for your savings targets</p><p><Check size={18}/> Envelopes for planned funds</p><p><Check size={18}/> Debts, receivables, and due dates</p><p><Check size={18}/> Habits that keep you consistent</p></div>
        </div>
      </section>
      <section className="public-faq" id="pertanyaan"><div className="public-container" data-reveal><div><h2>Good questions.<br/>Clear answers.</h2></div><div>{[
        ["What can Dokter Keuangan AI help me do?","Ask it to review recorded cashflow, discuss budget usage, or help plan contributions to a savings goal. You can also give clear instructions to record a transaction through conversation. Check the amount, wallet, and category afterward. AI can make mistakes and does not replace professional financial advice."],
        ["Already have an account? Where do I log in?","Click Log in at the top right. You'll reach the same AturDuitku login screen, with Google or email. Use the account and sign-in method you used before."],
        ["What if my records are incomplete?","Start with your current wallet balances and record from there. Dokter Keuangan AI can help explain the setup and what to add next. Its analysis depends on the records you provide; it cannot see spending that has not been recorded or imported."],
        ["Can I review just this month's income and expenses?","Yes. Use the date filters in Transactions or select a period in Reports. Totals cover the period you choose; selecting all dates includes older records. You can review a new month without deleting your previous transactions."],
        ["Do I need to install an app first?","No. Open AturDuitku in a browser on your phone or laptop. You can also add it to your home screen using the available PWA installation option."],
        ["Are bank accounts connected automatically?","Wallets track the balances of your bank accounts, e-wallets, and cash. Record transactions yourself or use the bank-statement import feature; this is not an automatic connection to your bank."],
        ["How do new accounts get access?","Create an account through the login screen. Full access follows payment verification and admin approval. Contact support if you need help activating your account."],
      ].map(([question,answer])=><details key={question}><summary>{question}<ChevronDown size={19}/></summary><p>{answer}</p></details>)}</div></div></section>
      <section className="public-closing public-container" data-reveal><img className="public-cheer-mascot" data-mascot="cheer" src="/landing/mascot-cheer.webp" alt="Dokter Keuangan giving an encouraging thumbs-up and wink" width="512" height="512" loading="lazy" decoding="async"/><h2>Give your next payday<br/>a plan.</h2><p>Record today's spending, check your budget, and bring your questions to Dokter Keuangan AI.</p><a className="public-primary" href="#login">Open AturDuitku <LogIn size={18}/></a></section>
    </main>
    <footer className="public-footer public-container"><a className="public-brand" href="#home"><img src="/icon-192.png" alt="" width="32" height="32"/>AturDuitku</a><p>Personal budgeting with Dokter Keuangan AI.</p><a href="https://wa.me/6287785472696" target="_blank" rel="noreferrer">Contact support <ArrowUpRight size={15}/></a><span>© 2025 AturDuitku</span></footer>
  </div>;
}

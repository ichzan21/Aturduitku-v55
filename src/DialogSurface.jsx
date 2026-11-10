import React, { useLayoutEffect, useRef } from 'react';

const stack=[];
const locked=new Map();
const focusable='button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const available=element=>!element.closest('[inert]')&&element.getClientRects().length>0&&getComputedStyle(element).visibility!=='hidden';

function lock(element) {
  const saved=locked.get(element);
  if(saved){saved.count++;return;}
  locked.set(element,{count:1,inert:element.inert,hidden:element.getAttribute('aria-hidden')});
  // Backdrops stay clickable for dismissal, but are never exposed to assistive technology.
  element.inert=!element.hasAttribute('data-dialog-backdrop');
  element.setAttribute('aria-hidden','true');
}
function unlock(element) {
  const saved=locked.get(element);
  if(!saved||--saved.count>0)return;
  element.inert=saved.inert;
  if(saved.hidden===null)element.removeAttribute('aria-hidden');else element.setAttribute('aria-hidden',saved.hidden);
  locked.delete(element);
}

export default function DialogSurface({as:Tag='div',onDismiss,initialFocus,children,...props}) {
  const ref=useRef(null);
  const previous=useRef(typeof document==='undefined'?null:document.activeElement);
  const dismiss=useRef(onDismiss);dismiss.current=onDismiss;
  useLayoutEffect(()=>{
    const dialog=ref.current;
    const siblings=[];
    stack.push(dialog);
    if(!dialog.contains(document.activeElement))dialog.focus({preventScroll:true});
    // Lock siblings along the ancestor path, retaining ownership for nested dialogs.
    for(let branch=dialog;branch.parentElement&&branch!==document.body;branch=branch.parentElement) {
      for(const sibling of branch.parentElement.children)if(sibling!==branch&&!['STYLE','SCRIPT','LINK'].includes(sibling.tagName)){lock(sibling);siblings.push(sibling);}
    }
    const top=()=>stack.at(-1)===dialog;
    const items=()=>[...dialog.querySelectorAll(focusable)].filter(available);
    const focusFirst=()=>{
      const requested=initialFocus&&dialog.querySelector(initialFocus);
      (requested&&available(requested)?requested:items()[0]||dialog).focus({preventScroll:true});
    };
    const frame=requestAnimationFrame(()=>{if(top()&&(document.activeElement===dialog||!dialog.contains(document.activeElement)))focusFirst();});
    const keydown=event=>{
      if(!top())return;
      if(event.key==='Escape'&&dismiss.current){event.preventDefault();event.stopImmediatePropagation();dismiss.current();return;}
      if(event.key!=='Tab')return;
      const list=items(),first=list[0],last=list.at(-1),active=document.activeElement;
      if(!first){event.preventDefault();dialog.focus();}
      else if(!dialog.contains(active)||(!event.shiftKey&&active===last)){event.preventDefault();(event.shiftKey?last:first).focus();}
      else if(event.shiftKey&&(active===first||active===dialog)){event.preventDefault();last.focus();}
    };
    const focusin=event=>{if(top()&&!dialog.contains(event.target))focusFirst();};
    document.addEventListener('keydown',keydown,true);
    document.addEventListener('focusin',focusin,true);
    return()=>{
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown',keydown,true);
      document.removeEventListener('focusin',focusin,true);
      const index=stack.indexOf(dialog);
      if(index>=0)stack.splice(index,1);
      siblings.reverse().forEach(unlock);
      const target=previous.current;
      requestAnimationFrame(()=>{if(target?.isConnected&&available(target)&&(!stack.length||stack.at(-1).contains(target)))target.focus({preventScroll:true});});
    };
  },[]);
  return <Tag ref={ref} role="dialog" aria-modal="true" tabIndex={-1} {...props}>{children}</Tag>;
}

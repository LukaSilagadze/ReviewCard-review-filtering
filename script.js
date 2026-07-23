// ---- CONFIG ----
const SUPABASE_URL = "https://tgzlwkouinonvoawoheb.supabase.co";
const SUPABASE_KEY = "sb_publishable_ZaKmf7Q58WLqFIrIOLkbPQ_55hT16Bn";
// Apps Script is used ONLY to send the email alert on negative feedback.
const NOTIFY_URL = "https://script.google.com/macros/s/AKfycbzE7cANUKGmKjf9fIIZzJt_bPtxUIhAGDyXuB-TbFBmrTLSA4zOg-yMQp-ZURE6zZ66JA/exec";

const params = new URLSearchParams(window.location.search);
const bizId = params.get('biz');
let business = null;
let rating = 0;

function show(id){
  ['stageRating','stageGoogle','stageFeedback','stageThanks','stageError'].forEach(s=>{
    document.getElementById(s).style.display = (s===id) ? 'flex' : 'none';
  });
}

async function loadBusiness(){
  if(!bizId){ show('stageError'); return; }
  try{
    const url = `${SUPABASE_URL}/rest/v1/businesses?biz_id=eq.${encodeURIComponent(bizId)}&select=name,google_review_link,logo_url,accent_color,notify_email`;
    const res = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    const rows = await res.json();
    const row = rows && rows[0];
    if(!row || !row.name || !row.google_review_link){ throw new Error('bad config'); }
    const data = {
      name: row.name,
      googleReviewLink: row.google_review_link,
      logoUrl: row.logo_url,
      accentColor: row.accent_color,
      notifyEmail: row.notify_email
    };
    business = data;
    document.getElementById('bizName').textContent = business.name;

    if(business.accentColor){
      applyAccentColor(business.accentColor);
    }

    preconnectToGoogle(business.googleReviewLink);

    if(business.logoUrl){
      const logo = document.getElementById('bizLogo');
      logo.src = business.logoUrl;
      document.getElementById('logoFrame').style.display = 'block';
      document.querySelector('.brandmark').style.display = 'none';
    }

    show('stageRating');
  }catch(err){
    show('stageError');
  }
}

function preconnectToGoogle(url){
  try{
    const origin = new URL(url).origin;
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = origin;
    document.head.appendChild(link);
  }catch(err){
    // Skip malformed URLs silently.
  }
}

function applyAccentColor(value){
  const hex = normalizeHexColor(value);
  if(!hex){ return; }

  const { r, g, b } = hexToRgb(hex);
  const darken = channel => Math.round(channel * 0.84);
  const root = document.documentElement.style;

  root.setProperty('--blue', hex);
  root.setProperty('--blue-dark', `rgb(${darken(r)}, ${darken(g)}, ${darken(b)})`);
  root.setProperty('--blue-rgb', `${r}, ${g}, ${b}`);
}

function normalizeHexColor(value){
  const color = String(value).trim();
  if(/^#[0-9a-f]{6}$/i.test(color)){ return color; }
  if(/^#[0-9a-f]{3}$/i.test(color)){
    return `#${color.slice(1).split('').map(char => char + char).join('')}`;
  }
  return null;
}

function hexToRgb(hex){
  const value = Number.parseInt(hex.slice(1), 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

function goToGoogle(){
  show('stageGoogle');
  setTimeout(() => { window.location.href = business.googleReviewLink; }, 0);
}

document.getElementById('goodExperienceBtn').addEventListener('click', () => {
  rating = 5;
  goToGoogle();
});

document.getElementById('badExperienceBtn').addEventListener('click', () => {
  rating = 1;
  show('stageFeedback');
});

document.getElementById('alsoGoogle').addEventListener('click', goToGoogle);

document.getElementById('sendFeedbackBtn').addEventListener('click', async () => {
  const comment = document.getElementById('feedbackText').value.trim();
  const btn = document.getElementById('sendFeedbackBtn');
  btn.disabled = true;
  btn.textContent = 'Sending...';

  try{
    await fetch(`${SUPABASE_URL}/rest/v1/feedbacks`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ biz_id: bizId, rating: rating, comment: comment })
    });
  }catch(err){ /* fail silently for the customer */ }

  if(business.notifyEmail){
    try{
      await fetch(NOTIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          email: business.notifyEmail,
          bizName: business.name,
          rating: rating,
          comment: comment
        })
      });
    }catch(err){ /* fail silently for the customer */ }
  }

  show('stageThanks');
});

loadBusiness();

// ---- CONFIG ----
const SUPABASE_URL = "https://tgzlwkouinonvoawoheb.supabase.co";
const SUPABASE_KEY = "sb_publishable_ZaKmf7Q58WLqFIrIOLkbPQ_55hT16Bn";
// Apps Script is used ONLY to send the email alert on negative feedback.
const NOTIFY_URL = "https://script.google.com/macros/s/AKfycbzE7cANUKGmKjf9fIIZzJt_bPtxUIhAGDyXuB-TbFBmrTLSA4zOg-yMQp-ZURE6zZ66JA/exec";

const params = new URLSearchParams(window.location.search);
const bizId = params.get('biz');
let business = null;
let rating = 0;
const labels = ['','Poor','Fair','Good','Very good','Excellent'];

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

    if(business.logoUrl){
      const logo = document.getElementById('bizLogo');
      logo.src = business.logoUrl;
      logo.style.display = 'block';
      document.querySelector('.brandmark').style.display = 'none';
    }

    buildStars();
    show('stageRating');
  }catch(err){
    show('stageError');
  }
}

function buildStars(){
  const starsEl = document.getElementById('stars');
  for(let i=1;i<=5;i++){
    const btn = document.createElement('button');
    btn.className = 'star-btn';
    btn.type = 'button';
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-label', `${i} star${i === 1 ? '' : 's'}`);
    btn.setAttribute('aria-checked', 'false');
    btn.innerHTML = '<svg viewBox="0 0 24 24"><polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9"/></svg>';
    btn.addEventListener('click', () => setRating(i));
    starsEl.appendChild(btn);
  }
}

function setRating(n){
  rating = n;
  document.querySelectorAll('.star-btn').forEach((b, idx) => {
    b.classList.toggle('lit', idx < n);
    b.setAttribute('aria-checked', idx === n - 1 ? 'true' : 'false');
  });
  document.getElementById('ratingLabel').textContent = labels[n];
  document.getElementById('continueBtn').disabled = false;
}

function goToGoogle(){
  show('stageGoogle');
  setTimeout(() => { window.location.href = business.googleReviewLink; }, 0);
}

document.getElementById('continueBtn').addEventListener('click', () => {
  if(rating >= 4){ goToGoogle(); }
  else{ show('stageFeedback'); }
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

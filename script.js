// ---- CONFIG ----
const SUPABASE_URL = "https://tgzlwkouinonvoawoheb.supabase.co";
const SUPABASE_KEY = "sb_publishable_ZaKmf7Q58WLqFIrIOLkbPQ_55hT16Bn";
// Supabase queues email when feedback is saved; Apps Script processes it server-side.

const params = new URLSearchParams(window.location.search);
const bizId = params.get('biz');
let business = null;
let rating = 0;
let currentLanguage = 'ka';

const translations = {
  ka: {
    back: 'უკან',
    followUs: 'გამოგვყევით',
    chooseLanguage: 'ენის არჩევა', languages: 'ენები', loading: 'იტვირთება...',
    ratingPrompt: 'როგორ შეაფასებდით გამოცდილებას?', chooseExperience: 'აირჩიეთ თქვენი გამოცდილება',
    positive: 'დადებითად', negative: 'უარყოფითად', thanks: 'მადლობა!',
    googlePrompt: 'გთხოვთ შეგვაფასოთ გუგლზეც', feedbackPrompt: 'რა გავაუმჯობესოთ?',
    feedbackPlaceholder: 'დატოვე ანონიმური მესიჯი...', send: 'გაგზავნა', sending: 'იგზავნება...',
    alsoGoogle: 'გირჩევნიათ Google? დატოვეთ შეფასება იქ',
    errorLine1: 'ამ გვერდის ჩატვირთვისას რაღაც შეცდომა დაფიქსირდა.',
    errorLine2: 'გთხოვთ, ხელახლა სცადოთ ბარათზე შეხება.', poweredBy: 'შექმნილია',
    sendErrorTitle: 'ვერ გაიგზავნა შეტყობინება',
    sendErrorBody: 'გთხოვთ სცადოთ ხელახლა, ან მოგვწერეთ პირდაპირ.',
    tryAgain: 'ხელახლა ცდა', emailDirectly: 'მოგვწერეთ ელფოსტით'
  },
  en: {
    back: 'Back',
    followUs: 'Follow us',
    chooseLanguage: 'Choose language', languages: 'Languages', loading: 'Loading...',
    ratingPrompt: 'How would you rate your experience?', chooseExperience: 'Choose your experience',
    positive: 'Positive', negative: 'Negative', thanks: 'Thank you!',
    googlePrompt: 'Please leave us a review on Google too', feedbackPrompt: 'What can we improve?',
    feedbackPlaceholder: 'Leave an anonymous message...', send: 'Send', sending: 'Sending...',
    alsoGoogle: 'Prefer Google? Leave a review there instead',
    errorLine1: 'Something went wrong while loading this page.',
    errorLine2: 'Please tap the card and try again.', poweredBy: 'Powered by',
    sendErrorTitle: "Couldn't send your message",
    sendErrorBody: 'Please try again, or email us directly.',
    tryAgain: 'Try again', emailDirectly: 'Email us directly'
  },
  ru: {
    back: 'Назад',
    followUs: 'Подписывайтесь на нас',
    chooseLanguage: 'Выбрать язык', languages: 'Языки', loading: 'Загрузка...',
    ratingPrompt: 'Как бы вы оценили свой опыт?', chooseExperience: 'Оцените свой опыт',
    positive: 'Положительно', negative: 'Отрицательно', thanks: 'Спасибо!',
    googlePrompt: 'Пожалуйста, оставьте нам отзыв и в Google', feedbackPrompt: 'Что мы можем улучшить?',
    feedbackPlaceholder: 'Оставьте анонимное сообщение...', send: 'Отправить', sending: 'Отправка...',
    alsoGoogle: 'Предпочитаете Google? Оставьте отзыв там',
    errorLine1: 'При загрузке страницы произошла ошибка.',
    errorLine2: 'Пожалуйста, коснитесь карточки и попробуйте снова.', poweredBy: 'При поддержке',
    sendErrorTitle: 'Не удалось отправить сообщение',
    sendErrorBody: 'Пожалуйста, попробуйте снова или напишите нам напрямую.',
    tryAgain: 'Попробовать снова', emailDirectly: 'Написать напрямую'
  }
};

function translate(key){
  return translations[currentLanguage][key];
}

function applyLanguage(language){
  if(!translations[language]){ return; }
  currentLanguage = language;
  document.documentElement.lang = language;

  document.querySelectorAll('[data-i18n]').forEach(element => {
    element.textContent = translate(element.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-aria]').forEach(element => {
    element.setAttribute('aria-label', translate(element.dataset.i18nAria));
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
    element.placeholder = translate(element.dataset.i18nPlaceholder);
  });

  const selectedButton = document.querySelector(`[data-language="${language}"]`);
  const selectedFlag = document.querySelector('.language-picker summary img');
  const optionFlag = selectedButton.querySelector('img');
  selectedFlag.src = optionFlag.src;
  selectedFlag.alt = selectedButton.getAttribute('aria-label');
  document.getElementById('selectedLanguageCode').textContent = { ka: 'GE', en: 'EN', ru: 'RU' }[language];

  try{ localStorage.setItem('reviewcard-language', language); }catch(err){ /* Storage may be unavailable. */ }
}

function show(id){
  ['stageRating','stageGoogle','stageFeedback','stageThanks','stageSendError','stageError'].forEach(s=>{
    document.getElementById(s).style.display = (s===id) ? 'flex' : 'none';
  });
}

async function loadBusiness(){
  if(!bizId){ show('stageError'); return; }
  try{
    const url = `${SUPABASE_URL}/rest/v1/businesses?biz_id=eq.${encodeURIComponent(bizId)}&select=name,google_review_link,logo_url,accent_color,notify_email,facebook_url,facebook_username,instagram_url,instagram_username,tiktok_url,tiktok_username`;
    const res = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    const rows = await res.json();
    const row = rows && rows[0];
    if(!row || !row.name || !row.google_review_link){ throw new Error('bad config'); }
    if(!/^https:\/\//i.test(row.google_review_link)){ throw new Error('unsafe google_review_link'); }
    const data = {
      name: row.name,
      googleReviewLink: row.google_review_link,
      logoUrl: (row.logo_url && /^https:\/\//i.test(row.logo_url)) ? row.logo_url : null,
      accentColor: row.accent_color,
      notifyEmail: row.notify_email
    };
    business = data;
    const businessName = document.getElementById('bizName');
    businessName.removeAttribute('data-i18n');
    businessName.textContent = business.name;
    renderSocialLinks(row);

    if(business.accentColor){
      applyAccentColor(business.accentColor);
    }

    preconnectToGoogle(business.googleReviewLink);

    if(business.logoUrl){
      const logo = document.getElementById('bizLogo');
      logo.onerror = () => {
        document.getElementById('logoFrame').style.display = 'none';
        document.querySelector('.brandmark').style.display = 'flex';
      };
      logo.src = business.logoUrl;
      document.getElementById('logoFrame').style.display = 'block';
      document.querySelector('.brandmark').style.display = 'none';
    }

    show('stageRating');
  }catch(err){
    show('stageError');
  }
}

function socialProfileUrl(value, platform){
  const domain = { facebook: 'facebook.com', instagram: 'instagram.com', tiktok: 'tiktok.com' }[platform];
  if(!domain || typeof value !== 'string' || !value.trim()){ return null; }
  try{
    const url = new URL(value.trim());
    if(url.protocol !== 'https:' || url.username || url.password || url.port){ return null; }
    if(url.hostname !== domain && !url.hostname.endsWith(`.${domain}`)){ return null; }
    return url.href;
  }catch(err){ return null; }
}

function renderSocialLinks(row){
  let visibleCount = 0;
  ['facebook', 'instagram', 'tiktok'].forEach(platform => {
    const link = document.getElementById(`${platform}Link`);
    const url = socialProfileUrl(row[`${platform}_url`], platform);
    link.hidden = !url;
    link.removeAttribute('href');
    link.removeAttribute('aria-label');
    document.getElementById(`${platform}Username`).textContent = '';
    if(!url){ return; }
    const username = row[`${platform}_username`];
    const label = typeof username === 'string' && username.trim() ? username.trim() : row.name;
    link.href = url;
    link.setAttribute('aria-label', `${{ facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok' }[platform]}: ${row.name} — ${label}`);
    document.getElementById(`${platform}Username`).textContent = label;
    visibleCount++;
  });
  document.getElementById('socialLinks').hidden = visibleCount === 0;
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
  const hover = { r: darken(r), g: darken(g), b: darken(b) };
  const root = document.documentElement.style;

  root.setProperty('--blue', hex);
  root.setProperty('--blue-dark', `rgb(${darken(r)}, ${darken(g)}, ${darken(b)})`);
  root.setProperty('--blue-rgb', `${r}, ${g}, ${b}`);
  root.setProperty('--button-text', accentForeground({ r, g, b }));
  root.setProperty('--button-hover-text', accentForeground(hover));
}

// Choose the higher-contrast foreground independently for normal and hover fills.
function accentForeground({ r, g, b }){
  const linear = channel => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  };
  const luminance = 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? '#000000' : '#ffffff';
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

document.getElementById('backToRatingBtn').addEventListener('click', () => {
  show('stageRating');
  document.getElementById('badExperienceBtn').focus();
});

async function saveFeedback(comment){
  const response = await fetch(`${SUPABASE_URL}/rest/v1/feedbacks`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ biz_id: bizId, rating: rating, comment: comment })
  });
  if(!response.ok){
    throw new Error(`Feedback request failed with status ${response.status}`);
  }
}

async function submitFeedback(){
  const comment = document.getElementById('feedbackText').value.trim();
  const sendBtn = document.getElementById('sendFeedbackBtn');
  const retryBtn = document.getElementById('retryFeedbackBtn');
  const backBtn = document.getElementById('backToRatingBtn');
  backBtn.disabled = true;
  [sendBtn, retryBtn].forEach(btn => { btn.disabled = true; btn.textContent = translate('sending'); });

  let saved = false;
  try{
    await saveFeedback(comment);
    saved = true;
  }catch(err){
    console.error('Could not save customer feedback, retrying once.', err);
    try{
      await saveFeedback(comment);
      saved = true;
    }catch(retryErr){
      console.error('Retry failed too.', retryErr);
    }
  }

  sendBtn.disabled = false;
  backBtn.disabled = false;
  sendBtn.textContent = translate('send');
  retryBtn.disabled = false;
  retryBtn.textContent = translate('tryAgain');

  if(saved){
    show('stageThanks');
    return;
  }

  const emailLink = document.getElementById('emailDirectlyLink');
  if(business.notifyEmail){
    emailLink.href = `mailto:${business.notifyEmail}?subject=${encodeURIComponent(business.name + ' – feedback')}&body=${encodeURIComponent(comment)}`;
    emailLink.style.display = 'block';
  }else{
    emailLink.style.display = 'none';
  }
  show('stageSendError');
}

document.getElementById('sendFeedbackBtn').addEventListener('click', submitFeedback);
document.getElementById('retryFeedbackBtn').addEventListener('click', submitFeedback);

const languagePicker = document.querySelector('.language-picker');

document.querySelectorAll('[data-language]').forEach(button => {
  button.addEventListener('click', () => {
    applyLanguage(button.dataset.language);
    languagePicker.removeAttribute('open');
  });
});

document.addEventListener('click', (event) => {
  if(languagePicker.open && !languagePicker.contains(event.target)){
    languagePicker.removeAttribute('open');
  }
});

let savedLanguage = 'ka';
try{ savedLanguage = localStorage.getItem('reviewcard-language') || 'ka'; }catch(err){ /* Use the default. */ }
applyLanguage(savedLanguage);
loadBusiness();

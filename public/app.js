/* ============================================
   ULEM RTS Landing Page — JavaScript
   UTM capture, forms, accordion, scroll reveals
   ============================================ */

(function () {
  'use strict';

  // ──────────────────────────────────────────────
  // CONFIG: Info Session Dates
  // Update these when new sessions are scheduled
  // ──────────────────────────────────────────────
  const INFO_SESSION_DATES = [
    { label: 'Fri, April 17', time: '12:00 PM', value: '2026-04-17T12:00:00' },
    { label: 'Tue, April 21', time: '6:00 PM', value: '2026-04-21T18:00:00' },
    { label: 'Fri, April 24', time: '12:00 PM', value: '2026-04-24T12:00:00' },
  ];

  // Serverless function endpoint
  const API_ENDPOINT = '/.netlify/functions/submit-form';

  // ──────────────────────────────────────────────
  // UTM CAPTURE
  // Store on page load in sessionStorage
  // ──────────────────────────────────────────────
  const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  const utmParams = {};

  function captureUTM() {
    const params = new URLSearchParams(window.location.search);
    UTM_KEYS.forEach(function (key) {
      var val = params.get(key);
      if (val) {
        utmParams[key] = val;
        try { sessionStorage.setItem(key, val); } catch (e) { /* noop */ }
      } else {
        try { utmParams[key] = sessionStorage.getItem(key) || ''; } catch (e) { utmParams[key] = ''; }
      }
    });
  }

  captureUTM();

  // ──────────────────────────────────────────────
  // ZARAZ TRACKING HELPER
  // Zaraz is loaded by Cloudflare (domain proxied).
  // window.zaraz may briefly be undefined on first paint.
  // ──────────────────────────────────────────────
  function track(event, params) {
    try {
      if (window.zaraz && typeof window.zaraz.track === 'function') {
        window.zaraz.track(event, params || {});
      }
    } catch (e) { /* noop */ }
  }

  // ──────────────────────────────────────────────
  // DATE PICKER
  // Render info session date cards
  // ──────────────────────────────────────────────
  var selectedDate = null;
  var datePicker = document.querySelector('.date-picker');

  function renderDatePicker() {
    if (!datePicker) return;
    datePicker.innerHTML = '';

    INFO_SESSION_DATES.forEach(function (session, i) {
      var card = document.createElement('div');
      card.className = 'date-option';
      card.setAttribute('role', 'radio');
      card.setAttribute('aria-checked', 'false');
      card.setAttribute('tabindex', i === 0 ? '0' : '-1');
      card.dataset.value = session.value;
      card.innerHTML =
        '<span class="date-option__day">' + session.label + '</span>' +
        '<span class="date-option__time">' + session.time + '</span>';

      card.addEventListener('click', function () { selectDate(card, session.value); });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectDate(card, session.value);
        }
        // Arrow key navigation
        var cards = datePicker.querySelectorAll('.date-option');
        var idx = Array.prototype.indexOf.call(cards, card);
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          var next = cards[(idx + 1) % cards.length];
          next.focus();
          next.setAttribute('tabindex', '0');
          card.setAttribute('tabindex', '-1');
        }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          var prev = cards[(idx - 1 + cards.length) % cards.length];
          prev.focus();
          prev.setAttribute('tabindex', '0');
          card.setAttribute('tabindex', '-1');
        }
      });

      datePicker.appendChild(card);
    });
  }

  function selectDate(card, value) {
    selectedDate = value;
    var cards = datePicker.querySelectorAll('.date-option');
    cards.forEach(function (c) {
      c.setAttribute('aria-checked', 'false');
      c.setAttribute('tabindex', '-1');
    });
    card.setAttribute('aria-checked', 'true');
    card.setAttribute('tabindex', '0');
    card.focus();
    clearError('dateError');
  }

  renderDatePicker();

  // ──────────────────────────────────────────────
  // FORM VALIDATION
  // ──────────────────────────────────────────────
  function showError(id, msg) {
    var el = document.getElementById(id);
    if (el) el.textContent = msg;
  }

  function clearError(id) {
    var el = document.getElementById(id);
    if (el) el.textContent = '';
  }

  function clearAllErrors(prefix) {
    var ids = [prefix + 'NameError', prefix + 'EmailError', prefix + 'PhoneError', prefix + 'ZipError'];
    ids.forEach(clearError);
    if (prefix === 'info') clearError('dateError');
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function validatePhone(phone) {
    var digits = phone.replace(/\D/g, '');
    return digits.length === 10 || digits.length === 11;
  }

  function validateZip(zip) {
    return /^\d{5}$/.test(zip);
  }

  function parseName(fullName) {
    var parts = fullName.trim().split(/\s+/);
    var firstName = parts[0] || '';
    var lastName = parts.slice(1).join(' ') || '';
    return { firstName: firstName, lastName: lastName };
  }

  function validateForm(prefix, requireDate) {
    var valid = true;
    clearAllErrors(prefix);

    var nameInput = document.getElementById(prefix + 'Name');
    var emailInput = document.getElementById(prefix + 'Email');
    var phoneInput = document.getElementById(prefix + 'Phone');
    var zipInput = document.getElementById(prefix + 'Zip');

    if (!nameInput.value.trim()) {
      showError(prefix + 'NameError', 'Please enter your name');
      nameInput.classList.add('form__input--error');
      valid = false;
    } else {
      nameInput.classList.remove('form__input--error');
    }

    if (!validateEmail(emailInput.value)) {
      showError(prefix + 'EmailError', 'Please enter a valid email');
      emailInput.classList.add('form__input--error');
      valid = false;
    } else {
      emailInput.classList.remove('form__input--error');
    }

    if (!validatePhone(phoneInput.value)) {
      showError(prefix + 'PhoneError', 'Please enter a 10-digit phone number');
      phoneInput.classList.add('form__input--error');
      valid = false;
    } else {
      phoneInput.classList.remove('form__input--error');
    }

    if (!validateZip(zipInput.value)) {
      showError(prefix + 'ZipError', 'Please enter a 5-digit zip code');
      zipInput.classList.add('form__input--error');
      valid = false;
    } else {
      zipInput.classList.remove('form__input--error');
    }

    if (requireDate && !selectedDate) {
      showError('dateError', 'Please select a session date');
      valid = false;
    }

    return valid;
  }

  // ──────────────────────────────────────────────
  // FORM SUBMISSION
  // ──────────────────────────────────────────────
  function submitForm(formEl, prefix, signupType) {
    var btn = formEl.querySelector('button[type="submit"]');

    if (!validateForm(prefix, signupType === 'info_session')) return;

    var nameInput = document.getElementById(prefix + 'Name');
    var emailInput = document.getElementById(prefix + 'Email');
    var phoneInput = document.getElementById(prefix + 'Phone');
    var zipInput = document.getElementById(prefix + 'Zip');
    var name = parseName(nameInput.value);

    var payload = {
      firstName: name.firstName,
      lastName: name.lastName,
      email: emailInput.value.trim(),
      phone: phoneInput.value.trim(),
      zipCode: zipInput.value.trim(),
      signupType: signupType,
      infoSessionDate: signupType === 'info_session' ? selectedDate : null,
      leadSource: 'Landing Page',
      utmSource: utmParams.utm_source || '',
      utmMedium: utmParams.utm_medium || '',
      utmCampaign: utmParams.utm_campaign || '',
      utmContent: utmParams.utm_content || '',
      utmTerm: utmParams.utm_term || '',
      submittedAt: new Date().toISOString(),
    };

    // Show loading
    btn.classList.add('btn--loading');

    fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        if (!res.ok) throw new Error('Submission failed');
        return res.json();
      })
      .then(function () {
        // Fire conversion events before redirect.
        // The thank-you page fires the primary Meta event; this is a safety net
        // with richer user data for Conversions API match quality.
        fireConversionEvents(signupType, payload);

        // Redirect to thank-you page
        var thankYouPage = signupType === 'info_session'
          ? '/thank-you-info-session.html'
          : '/thank-you-application.html';
        window.location.href = thankYouPage;
      })
      .catch(function () {
        btn.classList.remove('btn--loading');
        // Show generic inline error
        var errorId = prefix + 'EmailError';
        showError(errorId, 'Something went wrong. Please try again.');
      });
  }

  // ──────────────────────────────────────────────
  // CONVERSION TRACKING (via Cloudflare Zaraz → Meta Pixel + CAPI)
  // ──────────────────────────────────────────────
  function fireConversionEvents(signupType, payload) {
    // Meta standard event:
    //   - Application submission → CompleteRegistration (primary ad-optimization goal)
    //   - Info-session RSVP → Lead (secondary)
    var metaEvent = signupType === 'application' ? 'CompleteRegistration' : 'Lead';

    // User data improves Meta Conversions API match quality.
    // Zaraz hashes email/phone automatically before forwarding to Meta.
    track(metaEvent, {
      content_name: signupType,
      currency: 'USD',
      value: 0,
      email: payload.email,
      phone: payload.phone,
      first_name: payload.firstName,
      last_name: payload.lastName,
      zip_code: payload.zipCode,
      utm_source: payload.utmSource,
      utm_medium: payload.utmMedium,
      utm_campaign: payload.utmCampaign,
      utm_content: payload.utmContent,
      utm_term: payload.utmTerm,
    });
  }

  // ──────────────────────────────────────────────
  // FORM EVENT LISTENERS
  // ──────────────────────────────────────────────
  var infoForm = document.getElementById('infoSessionForm');
  var appForm = document.getElementById('applicationForm');

  if (infoForm) {
    infoForm.addEventListener('submit', function (e) {
      e.preventDefault();
      submitForm(infoForm, 'info', 'info_session');
    });

    // Track form start → Meta InitiateCheckout
    infoForm.addEventListener('focusin', function handler() {
      track('InitiateCheckout', { content_name: 'info_session' });
      infoForm.removeEventListener('focusin', handler);
    });
  }

  if (appForm) {
    appForm.addEventListener('submit', function (e) {
      e.preventDefault();
      submitForm(appForm, 'app', 'application');
    });

    appForm.addEventListener('focusin', function handler() {
      track('InitiateCheckout', { content_name: 'application' });
      appForm.removeEventListener('focusin', handler);
    });
  }

  // ──────────────────────────────────────────────
  // FAQ TRACKING
  // ──────────────────────────────────────────────
  document.querySelectorAll('.accordion__item').forEach(function (item) {
    item.addEventListener('toggle', function () {
      if (item.open) {
        var q = item.querySelector('summary span');
        track('faq_expanded', { faq_question: q ? q.textContent : '' });
      }
    });
  });

  // ──────────────────────────────────────────────
  // SCROLL REVEAL (Intersection Observer)
  // ──────────────────────────────────────────────
  function initScrollReveal() {
    var elements = document.querySelectorAll('[data-reveal]');
    if (!elements.length) return;

    if (!('IntersectionObserver' in window)) {
      // Fallback: show all
      elements.forEach(function (el) { el.classList.add('revealed'); });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );

    elements.forEach(function (el) { observer.observe(el); });
  }

  initScrollReveal();

  // ──────────────────────────────────────────────
  // CLICK-TO-COPY SECTION LINKS
  // Click any section headline to copy its anchor URL
  // ──────────────────────────────────────────────
  document.querySelectorAll('.section-headline').forEach(function (headline) {
    var section = headline.closest('section[id]');
    if (!section) return;

    headline.style.cursor = 'pointer';
    headline.setAttribute('title', 'Click to copy link to this section');

    headline.addEventListener('click', function () {
      var url = window.location.origin + window.location.pathname + '#' + section.id;

      navigator.clipboard.writeText(url).then(function () {
        headline.classList.add('link-copied');
        setTimeout(function () { headline.classList.remove('link-copied'); }, 1500);
      }).catch(function () {
        // Fallback for older browsers
        var input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        headline.classList.add('link-copied');
        setTimeout(function () { headline.classList.remove('link-copied'); }, 1500);
      });
    });
  });

  // ──────────────────────────────────────────────
  // SMOOTH SCROLL (for CTA links)
  // ──────────────────────────────────────────────
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var targetId = this.getAttribute('href');
      if (targetId === '#') return;
      var target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Move focus for accessibility
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
    });
  });


})();

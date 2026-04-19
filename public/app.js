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
    { label: 'Tue, April 21', time: '6:00 PM', value: '2026-04-21T18:00:00' },
    { label: 'Fri, April 24', time: '12:00 PM', value: '2026-04-24T12:00:00' },
    { label: 'Tue, April 28', time: '6:00 PM', value: '2026-04-28T18:00:00' },
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
    initApplicationWizard(appForm);

    appForm.addEventListener('focusin', function handler() {
      track('InitiateCheckout', { content_name: 'application' });
      appForm.removeEventListener('focusin', handler);
    });
  }

  // ──────────────────────────────────────────────
  // APPLICATION WIZARD — 4-step form
  // ──────────────────────────────────────────────
  function initApplicationWizard(formEl) {
    var TOTAL_STEPS = 4;
    var currentStep = 1;

    var steps = formEl.querySelectorAll('.wizard__step');
    var progressFill = document.getElementById('wizProgressFill');
    var stepLabel = document.getElementById('wizStepLabel');
    var stepTitle = document.getElementById('wizStepTitle');
    var backBtn = document.getElementById('wizBackBtn');
    var nextBtn = document.getElementById('wizNextBtn');
    var submitBtn = document.getElementById('appSubmitBtn');
    var formErrorSummary = document.getElementById('appFormError');

    var STEP_TITLES = {
      1: 'Your contact info',
      2: 'Eligibility',
      3: 'Your background',
      4: 'Your motivation',
    };

    function showStep(n) {
      steps.forEach(function (s) {
        var stepNum = parseInt(s.getAttribute('data-step'), 10);
        if (stepNum === n) {
          s.hidden = false;
          s.classList.add('wizard__step--active');
        } else {
          s.hidden = true;
          s.classList.remove('wizard__step--active');
        }
      });

      progressFill.style.width = (n / TOTAL_STEPS * 100) + '%';
      stepLabel.textContent = 'Step ' + n + ' of ' + TOTAL_STEPS;
      stepTitle.textContent = STEP_TITLES[n];

      backBtn.hidden = n === 1;
      nextBtn.hidden = n === TOTAL_STEPS;
      submitBtn.hidden = n !== TOTAL_STEPS;

      // Focus first input in step
      var firstInput = steps[n - 1].querySelector('input, select, textarea');
      if (firstInput) setTimeout(function () { firstInput.focus(); }, 50);

      // Clear form-level error when navigating
      if (formErrorSummary) formErrorSummary.textContent = '';

      // Track wizard step progression
      track('application_step_view', { step: n, step_title: STEP_TITLES[n] });
    }

    function clearFieldError(id) {
      var el = document.getElementById(id);
      if (el) el.textContent = '';
      var input = document.getElementById(id.replace(/Error$/, ''));
      if (input) input.classList.remove('form__input--error');
    }

    function setFieldError(id, message) {
      var el = document.getElementById(id);
      if (el) el.textContent = message;
      var input = document.getElementById(id.replace(/Error$/, ''));
      if (input) input.classList.add('form__input--error');
    }

    // Step-level validation. Returns true if valid, false otherwise.
    function validateStep(step) {
      var valid = true;

      if (step === 1) {
        ['appFirstName', 'appLastName', 'appEmail', 'appPhone'].forEach(function (id) {
          clearFieldError(id + 'Error');
        });

        var firstName = document.getElementById('appFirstName').value.trim();
        var lastName = document.getElementById('appLastName').value.trim();
        var email = document.getElementById('appEmail').value.trim();
        var phone = document.getElementById('appPhone').value.trim();

        if (firstName.length < 1) {
          setFieldError('appFirstNameError', 'First name is required'); valid = false;
        }
        if (lastName.length < 1) {
          setFieldError('appLastNameError', 'Last name is required'); valid = false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          setFieldError('appEmailError', 'Enter a valid email address'); valid = false;
        }
        var phoneDigits = phone.replace(/\D/g, '');
        if (phoneDigits.length < 10) {
          setFieldError('appPhoneError', 'Enter a valid phone number'); valid = false;
        }
      }

      if (step === 2) {
        ['appDob', 'appZip', 'appDaytime'].forEach(function (id) {
          clearFieldError(id + 'Error');
        });

        var dob = document.getElementById('appDob').value;
        var zip = document.getElementById('appZip').value.trim();
        var daytime = document.getElementById('appDaytime').checked;

        if (!dob) {
          setFieldError('appDobError', 'Date of birth is required'); valid = false;
        } else {
          var age = calculateAge(dob);
          if (age < 18) {
            setFieldError('appDobError', 'You must be 18 or older to apply.'); valid = false;
          } else if (age > 120) {
            setFieldError('appDobError', 'Please enter a valid date of birth.'); valid = false;
          }
        }

        if (!/^[0-9]{5}$/.test(zip)) {
          setFieldError('appZipError', 'Enter a 5-digit zip code'); valid = false;
        }

        if (!daytime) {
          setFieldError('appDaytimeError', 'Daytime availability is required for this program. If you cannot attend Mon–Wed 10 AM–4 PM, the program is not a fit for Cohort 1.'); valid = false;
        }
      }

      if (step === 3) {
        ['appNeighborhood', 'appLanguage', 'appEmployment', 'appEducation', 'appReferral'].forEach(function (id) {
          clearFieldError(id + 'Error');
        });

        var neighborhood = document.getElementById('appNeighborhood').value.trim();
        var language = document.getElementById('appLanguage').value.trim();
        var employment = document.getElementById('appEmployment').value;
        var education = document.getElementById('appEducation').value;
        var referral = document.getElementById('appReferral').value;

        if (neighborhood.length < 2) {
          setFieldError('appNeighborhoodError', 'Neighborhood is required'); valid = false;
        }
        if (language.length < 2) {
          setFieldError('appLanguageError', 'Primary language is required'); valid = false;
        }
        if (!employment) {
          setFieldError('appEmploymentError', 'Please select your employment status'); valid = false;
        }
        if (!education) {
          setFieldError('appEducationError', 'Please select your education level'); valid = false;
        }
        if (!referral) {
          setFieldError('appReferralError', 'Please select how you heard about RTS'); valid = false;
        }
      }

      if (step === 4) {
        ['appMotivationNow', 'appMotivationGoal'].forEach(function (id) {
          clearFieldError(id + 'Error');
        });

        var motivationNow = document.getElementById('appMotivationNow').value.trim();
        var motivationGoal = document.getElementById('appMotivationGoal').value.trim();

        if (motivationNow.length < 50) {
          setFieldError('appMotivationNowError', 'Please share at least 50 characters (' + motivationNow.length + ' so far).'); valid = false;
        }
        if (motivationGoal.length < 50) {
          setFieldError('appMotivationGoalError', 'Please share at least 50 characters (' + motivationGoal.length + ' so far).'); valid = false;
        }
      }

      return valid;
    }

    function calculateAge(dobStr) {
      var dob = new Date(dobStr);
      if (isNaN(dob.getTime())) return 0;
      var today = new Date();
      var age = today.getFullYear() - dob.getFullYear();
      var m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
      return age;
    }

    // Character counters for textareas
    ['appMotivationNow', 'appMotivationGoal'].forEach(function (id) {
      var ta = document.getElementById(id);
      var counter = document.getElementById(id + 'Count');
      if (ta && counter) {
        ta.addEventListener('input', function () {
          counter.textContent = ta.value.length;
        });
      }
    });

    backBtn.addEventListener('click', function () {
      if (currentStep > 1) {
        currentStep--;
        showStep(currentStep);
      }
    });

    nextBtn.addEventListener('click', function () {
      if (!validateStep(currentStep)) return;
      if (currentStep < TOTAL_STEPS) {
        currentStep++;
        showStep(currentStep);
      }
    });

    formEl.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validateStep(currentStep)) return;
      submitApplication();
    });

    function submitApplication() {
      submitBtn.classList.add('btn--loading');
      formErrorSummary.textContent = '';

      var payload = {
        signupType: 'application',
        firstName: document.getElementById('appFirstName').value.trim(),
        lastName: document.getElementById('appLastName').value.trim(),
        email: document.getElementById('appEmail').value.trim(),
        phone: document.getElementById('appPhone').value.trim(),
        dateOfBirth: document.getElementById('appDob').value,
        zipCode: document.getElementById('appZip').value.trim(),
        daytimeAvailable: document.getElementById('appDaytime').checked,
        neighborhood: document.getElementById('appNeighborhood').value.trim(),
        primaryLanguage: document.getElementById('appLanguage').value.trim(),
        employmentStatus: document.getElementById('appEmployment').value,
        educationLevel: document.getElementById('appEducation').value,
        referralSource: document.getElementById('appReferral').value,
        motivationNow: document.getElementById('appMotivationNow').value.trim(),
        motivationGoal: document.getElementById('appMotivationGoal').value.trim(),
        leadSource: 'Website_msimbo.org',
        utmSource: utmParams.utm_source || '',
        utmMedium: utmParams.utm_medium || '',
        utmCampaign: utmParams.utm_campaign || '',
        utmContent: utmParams.utm_content || '',
        utmTerm: utmParams.utm_term || '',
        submittedAt: new Date().toISOString(),
      };

      fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          return res.json().then(function (body) { return { ok: res.ok, status: res.status, body: body }; });
        })
        .then(function (result) {
          if (!result.ok) {
            submitBtn.classList.remove('btn--loading');
            if (result.status === 409) {
              formErrorSummary.textContent = result.body && result.body.error
                ? result.body.error
                : 'An application with this email already exists. Contact program-rts@ulem.org if this is a mistake.';
            } else {
              formErrorSummary.textContent = 'Something went wrong. Please try again, or contact program-rts@ulem.org.';
            }
            return;
          }

          fireConversionEvents('application', {
            firstName: payload.firstName,
            lastName: payload.lastName,
            email: payload.email,
            phone: payload.phone,
            zipCode: payload.zipCode,
            utmSource: payload.utmSource,
            utmMedium: payload.utmMedium,
            utmCampaign: payload.utmCampaign,
            utmContent: payload.utmContent,
            utmTerm: payload.utmTerm,
          });

          window.location.href = '/thank-you-application.html';
        })
        .catch(function () {
          submitBtn.classList.remove('btn--loading');
          formErrorSummary.textContent = 'Something went wrong. Please try again, or contact program-rts@ulem.org.';
        });
    }

    showStep(1);
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

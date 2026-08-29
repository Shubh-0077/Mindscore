/* ==========================================================================
   Mental Health Score Predictor — Application Logic
   Sections: Config → DOM refs → Validation → Floating labels → Ripple
             → API call → Result rendering → Error handling → Init
   ========================================================================== */

(() => {
  "use strict";

  /* ---------- Config ---------- */
  const API_BASE_URL = "http://127.0.0.1:8000";
  const PREDICT_ENDPOINT = `${API_BASE_URL}/predict`;
  const GAUGE_CIRCUMFERENCE = 2 * Math.PI * 70; // r = 70 in the SVG

  // Field-level validation rules. Each function returns an error string, or "" if valid.
  const VALIDATORS = {
    age: (v) => {
      if (v === "") return "Age is required.";
      const n = Number(v);
      if (!Number.isFinite(n) || n < 1 || n > 100) return "Enter an age between 1 and 100.";
      return "";
    },
    gender: (v) => (v === "" ? "Please select a gender." : ""),
    country: (v) => (v.trim() === "" ? "Country is required." : ""),
    academic_level: (v) => (v === "" ? "Please select an academic level." : ""),
    most_used_platform: (v) => (v === "" ? "Please select a platform." : ""),
    purpose_of_use: (v) => (v === "" ? "Please select a purpose." : ""),
    avg_daily_usage_hours: (v) => rangeError(v, 0, 24, "Usage hours"),
    daily_unlocks: (v) => {
      if (v === "") return "Daily unlocks is required.";
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) return "Daily unlocks must be 0 or greater.";
      return "";
    },
    study_hours: (v) => rangeError(v, 0, 24, "Study hours"),
    physical_activity_hours: (v) => rangeError(v, 0, 24, "Physical activity hours"),
    sleep_hours_per_night: (v) => rangeError(v, 0, 24, "Sleep hours"),
    stress_level: (v) => (v === "" ? "Please select a stress level." : ""),
  };

  // Fields whose values must be sent as numbers rather than strings.
  const NUMERIC_FIELDS = new Set([
    "age",
    "avg_daily_usage_hours",
    "daily_unlocks",
    "study_hours",
    "physical_activity_hours",
    "sleep_hours_per_night",
  ]);

  // Score interpretation bands (frontend display only — does not affect prediction).
  const INTERPRETATION_BANDS = [
    { max: 3.0, label: "Needs Immediate Attention", tone: "danger", description: "This score suggests significant strain. Consider reaching out to a counselor, trusted mentor, or mental health professional soon." },
    { max: 5.5, label: "Poor Mental Wellbeing", tone: "warning", description: "There are signs of meaningful stress. Small, consistent changes to sleep, activity, and screen time could help." },
    { max: 7.0, label: "Moderate Wellbeing", tone: "info", description: "A reasonably balanced state with room to improve. Keep an eye on sleep and stress levels." },
    { max: 8.5, label: "Healthy Mental Wellbeing", tone: "success", description: "Your habits appear to be supporting a healthy state of mind. Keep up the balance." },
    { max: 10.0, label: "Excellent Mental Wellbeing", tone: "success", description: "A strong, well-balanced lifestyle. Your habits are clearly working in your favor." },
  ];

  /* ---------- DOM refs ---------- */
  const form = document.getElementById("predict-form");
  const predictBtn = document.getElementById("predict-btn");
  const resetBtn = document.getElementById("reset-btn");
  const predictAgainBtn = document.getElementById("predict-again-btn");
  const errorRetryBtn = document.getElementById("error-retry-btn");

  const resultSection = document.getElementById("result-section");
  const resultCard = document.getElementById("result-card");
  const errorCard = document.getElementById("error-card");
  const errorMessageEl = document.getElementById("error-message");

  const gaugeFill = document.getElementById("gauge-fill");
  const scoreValueEl = document.getElementById("score-value");
  const resultBadge = document.getElementById("result-badge");
  const resultTitle = document.getElementById("result-title");
  const resultDescription = document.getElementById("result-description");

  let isSubmitting = false;

  /* ---------- Validation helpers ---------- */

  /**
   * Generic numeric range validator used by several hour-based fields.
   */
  function rangeError(value, min, max, label) {
    if (value === "") return `${label} is required.`;
    const n = Number(value);
    if (!Number.isFinite(n) || n < min || n > max) {
      return `${label} must be between ${min} and ${max}.`;
    }
    return "";
  }

  /**
   * Validates a single field element, updates its visual state, and
   * returns true if valid.
   */
  function validateField(inputEl) {
    const name = inputEl.name;
    const validator = VALIDATORS[name];
    if (!validator) return true;

    const errorEl = document.getElementById(`${name}-error`);
    const message = validator(inputEl.value);

    if (message) {
      inputEl.classList.add("is-invalid");
      inputEl.setAttribute("aria-invalid", "true");
      if (errorEl) errorEl.textContent = message;
      return false;
    }

    inputEl.classList.remove("is-invalid");
    inputEl.removeAttribute("aria-invalid");
    if (errorEl) errorEl.textContent = "";
    return true;
  }

  /**
   * Validates every field in the form. Returns true only if all fields pass.
   * Focuses the first invalid field for a fast fix.
   */
  function validateForm() {
    const fields = Array.from(form.elements).filter((el) => VALIDATORS[el.name]);
    let firstInvalid = null;
    let allValid = true;

    fields.forEach((field) => {
      const valid = validateField(field);
      if (!valid) {
        allValid = false;
        if (!firstInvalid) firstInvalid = field;
      }
    });

    if (firstInvalid) {
      firstInvalid.focus();
      firstInvalid.closest(".field")?.classList.add("shake");
      setTimeout(() => firstInvalid.closest(".field")?.classList.remove("shake"), 420);
    }

    return allValid;
  }

  /**
   * Reads the form and builds the exact JSON payload the API expects,
   * coercing numeric fields to numbers.
   */
  function buildPayload() {
    const formData = new FormData(form);
    const payload = {};

    formData.forEach((value, key) => {
      payload[key] = NUMERIC_FIELDS.has(key) ? Number(value) : value.trim();
    });

    return payload;
  }

  /* ---------- Floating label support for <select> ---------- */

  /**
   * Native <select> elements don't support :placeholder-shown, so we
   * toggle a class manually whenever a real value is chosen.
   */
  function initSelectLabels() {
    const selects = form.querySelectorAll("select");
    selects.forEach((select) => {
      select.addEventListener("change", () => {
        select.classList.toggle("has-value", select.value !== "");
        validateField(select);
      });
    });
  }

  /**
   * Validate text/number inputs as the user leaves them, and clear
   * errors as they type once corrected.
   */
  function initInputLiveValidation() {
    const inputs = form.querySelectorAll("input");
    inputs.forEach((input) => {
      input.addEventListener("blur", () => validateField(input));
      input.addEventListener("input", () => {
        if (input.classList.contains("is-invalid")) validateField(input);
      });
    });
  }

  /* ---------- Ripple micro-interaction ---------- */
  function attachRipple(button) {
    button.addEventListener("click", (event) => {
      const rect = button.getBoundingClientRect();
      const ripple = document.createElement("span");
      const size = Math.max(rect.width, rect.height);

      ripple.className = "ripple";
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${event.clientY - rect.top - size / 2}px`;

      button.appendChild(ripple);
      ripple.addEventListener("animationend", () => ripple.remove());
    });
  }

  /* ---------- Loading state ---------- */
  function setLoadingState(loading) {
    isSubmitting = loading;
    predictBtn.classList.toggle("is-loading", loading);
    predictBtn.disabled = loading;
    predictBtn.querySelector(".btn-predict__label").textContent = loading
      ? "Predicting..."
      : "Predict Score";

    Array.from(form.elements).forEach((el) => {
      if (el !== predictBtn) el.disabled = loading;
    });
  }

  /* ---------- API call ---------- */

  /**
   * Sends the profile to the FastAPI backend and returns the parsed
   * JSON response. Throws a descriptive Error on any failure.
   */
  async function requestPrediction(payload) {
    let response;

    try {
      response = await fetch(PREDICT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (networkError) {
      throw new Error(
        "Unable to connect to the prediction server. Please ensure the FastAPI backend is running."
      );
    }

    if (!response.ok) {
      let detail = `The server responded with status ${response.status}.`;
      try {
        const errorBody = await response.json();
        if (errorBody?.detail) {
          detail = typeof errorBody.detail === "string"
            ? errorBody.detail
            : JSON.stringify(errorBody.detail);
        }
      } catch (_) {
        /* response had no JSON body — keep the generic message */
      }
      throw new Error(detail);
    }

    return response.json();
  }

  /* ---------- Result rendering ---------- */

  /**
   * Finds the interpretation band (label, tone, description) for a score.
   */
  function getInterpretation(score) {
    return (
      INTERPRETATION_BANDS.find((band) => score <= band.max) ??
      INTERPRETATION_BANDS[INTERPRETATION_BANDS.length - 1]
    );
  }

  /**
   * Renders the animated result card for a successful prediction.
   */
  function displayResult(score) {
    errorCard.hidden = true;
    resultCard.hidden = false;

    const clamped = Math.min(Math.max(score, 0), 10);
    const interpretation = getInterpretation(clamped);

    // Animate the gauge ring.
    const fillRatio = clamped / 10;
    const offset = GAUGE_CIRCUMFERENCE * (1 - fillRatio);
    const toneColor = {
      danger: "var(--danger)",
      warning: "var(--warning)",
      info: "var(--info)",
      success: "var(--success)",
    }[interpretation.tone];

    gaugeFill.style.stroke = toneColor;
    // Reset then animate on next frame so the transition always plays.
    gaugeFill.style.strokeDashoffset = GAUGE_CIRCUMFERENCE;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        gaugeFill.style.strokeDashoffset = offset;
      });
    });

    animateScoreText(clamped);

    resultBadge.textContent = interpretation.label;
    resultBadge.className = `result-card__badge tone-${interpretation.tone}`;
    resultTitle.textContent = "Mental Health Score";
    resultDescription.textContent = interpretation.description;

    scrollToResult();
  }

  /**
   * Counts the score value up from 0 for a satisfying reveal.
   */
  function animateScoreText(target) {
    const durationMs = 900;
    const start = performance.now();

    function tick(now) {
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = (target * eased).toFixed(2);
      scoreValueEl.textContent = current;
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  /**
   * Renders the error card with a human-readable message.
   */
  function displayErrorCard(message) {
    resultCard.hidden = true;
    errorCard.hidden = false;
    errorMessageEl.textContent = message;
    scrollToResult();
  }

  function scrollToResult() {
    resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ---------- Reset ---------- */
  function resetForm() {
    form.reset();

    Array.from(form.elements).forEach((el) => {
      el.classList.remove("is-invalid", "has-value");
      el.removeAttribute("aria-invalid");
    });

    form.querySelectorAll(".field__error").forEach((el) => (el.textContent = ""));

    resultCard.hidden = true;
    errorCard.hidden = true;
    gaugeFill.style.strokeDashoffset = GAUGE_CIRCUMFERENCE;
    scoreValueEl.textContent = "0.0";

    form.querySelector("#age")?.focus();
  }

  /* ---------- Submit handler ---------- */
  async function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting) return;

    if (!validateForm()) return;

    const payload = buildPayload();
    setLoadingState(true);

    try {
      const data = await requestPrediction(payload);
      const score = Number(data.predicted_mental_health_score);

      if (!Number.isFinite(score)) {
        throw new Error("The server returned an unexpected response format.");
      }

      displayResult(score);
    } catch (error) {
      displayErrorCard(error.message || "Something went wrong. Please try again.");
    } finally {
      setLoadingState(false);
    }
  }

  /* ---------- Init ---------- */
  function init() {
    initSelectLabels();
    initInputLiveValidation();
    attachRipple(predictBtn);

    form.addEventListener("submit", handleSubmit);
    resetBtn.addEventListener("click", resetForm);
    predictAgainBtn.addEventListener("click", () => {
      resultCard.hidden = true;
      window.scrollTo({ top: 0, behavior: "smooth" });
      form.querySelector("#age")?.focus();
    });
    errorRetryBtn.addEventListener("click", () => {
      errorCard.hidden = true;
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    gaugeFill.style.strokeDasharray = String(GAUGE_CIRCUMFERENCE);
    gaugeFill.style.strokeDashoffset = String(GAUGE_CIRCUMFERENCE);

    // Auto-focus the first field for a fast start.
    document.getElementById("age")?.focus();
  }

  document.addEventListener("DOMContentLoaded", init);
})();

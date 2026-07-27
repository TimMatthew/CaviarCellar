(function () {
      var form = document.getElementById("reservation-form");
      if (!form) return;

      var overlay = document.getElementById("reservation-overlay");
      var summary = document.getElementById("reservation-summary");
      var closeBtn = document.getElementById("reservation-close");
      var slotsGrid = document.getElementById("time-slots");

      var card = document.getElementById("reservation-card");
      var cardDate = document.getElementById("reservation-card-date");
      var monthLabel = document.getElementById("calendar-month");
      var daysGrid = document.getElementById("calendar-days");
      var prevBtn = document.getElementById("calendar-prev");
      var nextBtn = document.getElementById("calendar-next");

      /* ------------------------------------------------------------
         Session model: 20-minute sessions, 10:00–21:00
         (10:00–10:20 … 20:40–21:00 → 33 slots per day).
         ------------------------------------------------------------ */
      var OPEN_MIN = 10 * 60;
      var CLOSE_MIN = 21 * 60;
      var SESSION = 20;

      function fmt(totalMinutes) {
        var h = Math.floor(totalMinutes / 60);
        var m = totalMinutes % 60;
        return (h < 10 ? "0" + h : h) + ":" + (m < 10 ? "0" + m : m);
      }

      var ALL_SLOTS = [];
      for (var s = OPEN_MIN; s + SESSION <= CLOSE_MIN; s += SESSION) {
        ALL_SLOTS.push(fmt(s) + " – " + fmt(s + SESSION));
      }

      /* ------------------------------------------------------------
         Mock availability.
         Until a booking backend exists, free slots are derived from a
         deterministic hash of the date, so every visitor sees the same
         stable pattern: some days fully booked (grey), others with a
         varying subset of free sessions (green).
         ------------------------------------------------------------ */
      function hashDate(key) {
        var h = 0;
        for (var i = 0; i < key.length; i++) {
          h = (h * 31 + key.charCodeAt(i)) % 997;
        }
        return h;
      }

      function freeSlotsFor(dateKey) {
        var h = hashDate(dateKey);
        if (h % 4 === 0) return []; // ~25% of days fully booked
        return ALL_SLOTS.filter(function (_, index) {
          return (h + index * 7) % 3 !== 0; // stable per-day subset
        });
      }

      function dateKey(year, month, day) {
        return (
          year + "-" +
          String(month + 1).padStart(2, "0") + "-" +
          String(day).padStart(2, "0")
        );
      }

      /* ------------------------------------------------------------
         Calendar rendering (sketch: month header with arrows, 7-column
         grid of day circles; grey = fully booked, green = free slots).
         Weeks start on Monday; past days are disabled.
         ------------------------------------------------------------ */
      var MONTHS_UA = [
        "СІЧЕНЬ", "ЛЮТИЙ", "БЕРЕЗЕНЬ", "КВІТЕНЬ",
        "ТРАВЕНЬ", "ЧЕРВЕНЬ", "ЛИПЕНЬ", "СЕРПЕНЬ",
        "ВЕРЕСЕНЬ", "ЖОВТЕНЬ", "ЛИСТОПАД", "ГРУДЕНЬ"
      ];

      var today = new Date();
      today.setHours(0, 0, 0, 0);

      var viewYear = today.getFullYear();
      var viewMonth = today.getMonth();
      var selectedKey = null;

      function renderCalendar() {
        monthLabel.textContent =
          MONTHS_UA[viewMonth] +
          (viewYear !== today.getFullYear() ? " " + viewYear : "");

        // Don't navigate into the past
        prevBtn.disabled =
          viewYear === today.getFullYear() && viewMonth === today.getMonth();

        daysGrid.innerHTML = "";
        var frag = document.createDocumentFragment();

        // Monday-first offset for the 1st of the month
        var firstWeekday = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;
        for (var pad = 0; pad < firstWeekday; pad++) {
          var spacer = document.createElement("span");
          spacer.className = "calendar__day calendar__day--empty";
          spacer.setAttribute("aria-hidden", "true");
          frag.appendChild(spacer);
        }

        var daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

        for (var day = 1; day <= daysInMonth; day++) {
          var key = dateKey(viewYear, viewMonth, day);
          var isPast = new Date(viewYear, viewMonth, day) < today;
          var free = isPast ? [] : freeSlotsFor(key);

          var cell = document.createElement("button");
          cell.type = "button";
          cell.className =
            "calendar__day " +
            (free.length ? "calendar__day--free" : "calendar__day--busy");
          cell.textContent = day;
          cell.dataset.key = key;

          if (key === selectedKey) cell.classList.add("is-selected");

          if (!free.length) {
            cell.disabled = true;
            cell.setAttribute(
              "aria-label",
              day + ": " + (isPast ? "минула дата" : "всі сеанси зайняті")
            );
          } else {
            cell.setAttribute(
              "aria-label",
              day + ": вільних сеансів — " + free.length
            );
          }

          frag.appendChild(cell);
        }

        daysGrid.appendChild(frag);
      }

      prevBtn.addEventListener("click", function () {
        viewMonth--;
        if (viewMonth < 0) { viewMonth = 11; viewYear--; }
        renderCalendar();
      });

      nextBtn.addEventListener("click", function () {
        viewMonth++;
        if (viewMonth > 11) { viewMonth = 0; viewYear++; }
        renderCalendar();
      });

      /* ------------------------------------------------------------
         Day selection → reveal the reservation card below the
         calendar and rebuild the slot grid with that day's free
         sessions only.
         ------------------------------------------------------------ */
      function renderSlots(freeList) {
        slotsGrid.innerHTML = "";
        var frag = document.createDocumentFragment();

        freeList.forEach(function (range) {
          var label = document.createElement("label");
          label.className = "time-slot";

          var radio = document.createElement("input");
          radio.type = "radio";
          radio.name = "time";
          radio.value = range;

          var text = document.createElement("span");
          text.className = "time-slot__text";
          text.textContent = range;

          label.appendChild(radio);
          label.appendChild(text);
          frag.appendChild(label);
        });

        slotsGrid.appendChild(frag);
      }

      daysGrid.addEventListener("click", function (event) {
        var cell = event.target.closest(".calendar__day--free");
        if (!cell) return;

        var current = daysGrid.querySelector(".calendar__day.is-selected");
        if (current) current.classList.remove("is-selected");
        cell.classList.add("is-selected");

        selectedKey = cell.dataset.key;
        renderSlots(freeSlotsFor(selectedKey));

        cardDate.textContent =
          "Обрана дата: " + selectedKey.split("-").reverse().join(".");

        var reveal = card.hidden;
        card.hidden = false;
        if (reveal) {
          card.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      });

      renderCalendar();

      function nsnRange(country) {
        var n = country.nsn;
        return Array.isArray(n) ? { min: n[0], max: n[1] } : { min: n, max: n };
      }

      var codeSelect = document.getElementById("client-phone-code");
      var phoneNumber = document.getElementById("client-phone");
      var phoneHint = document.getElementById("phone-hint");

      if (codeSelect) {
        var codeFrag = document.createDocumentFragment();

        DIAL_CODES.forEach(function (country, index) {
          var option = document.createElement("option");
          option.value = String(index); // index → unambiguous (+1 twice)
          option.textContent = country.flag + " " + country.code;
          option.title = country.name;
          option.setAttribute("aria-label", country.name + " " + country.code);
          if (index === 0) option.selected = true; // Україна за замовчуванням
          codeFrag.appendChild(option);
        });

        codeSelect.appendChild(codeFrag);
      }

      function currentCountry() {
        return DIAL_CODES[Number(codeSelect.value) || 0];
      }

      /* Digits-only value grouped in threes for readability */
      function groupDigits(digits) {
        return digits.replace(/(.{3})/g, "$1 ").trim();
      }

      /* Placeholder like "XXX XXX XXX" built from the minimum length */
      function updatePhoneMeta() {
        var country = currentCountry();
        var range = nsnRange(country);

        phoneNumber.placeholder =
          groupDigits(new Array(range.min + 1).join("X"));
        phoneNumber.maxLength = range.max + Math.ceil(range.max / 3); // digits + spaces

        phoneHint.textContent =
          country.name + " " + country.code + ": " +
          (range.min === range.max
            ? range.min + " цифр після коду"
            : range.min + "–" + range.max + " цифр після коду");

        phoneHint.classList.remove("is-error");
        phoneNumber.classList.remove("is-error");

        // Re-cap an already-typed number against the new country
        if (phoneNumber.value) {
          phoneNumber.value =
            groupDigits(phoneDigits(phoneNumber.value).slice(0, range.max));
        }
      }

      function phoneDigits(raw) {
        return raw.replace(/\D/g, "");
      }

      /* Normalise input: digits only, capped at the country maximum.
         If the user pastes a full number ("+380 67…", "0038067…"),
         strip the redundant country-code prefix first. */
      phoneNumber.addEventListener("input", function () {
        var country = currentCountry();
        var range = nsnRange(country);
        var raw = phoneNumber.value;
        var digits = phoneDigits(raw);
        var codeDigits = country.code.replace(/\D/g, "");

        var pastedFull =
          /^\s*\+/.test(raw) || digits.indexOf("00" + codeDigits) === 0;

        if (pastedFull) {
          if (digits.indexOf("00" + codeDigits) === 0) {
            digits = digits.slice(2 + codeDigits.length);
          } else if (digits.indexOf(codeDigits) === 0) {
            digits = digits.slice(codeDigits.length);
          }
        }

        /* National trunk prefix: "0671234567" → "671234567" for +380.
           Only strip the leading 0 when the number would otherwise be
           too long — Italian numbers, for example, genuinely start
           with 0 and must keep it. */
        if (digits.length > range.max && digits.charAt(0) === "0") {
          digits = digits.slice(1);
        }

        digits = digits.slice(0, range.max);
        phoneNumber.value = groupDigits(digits);

        phoneHint.classList.remove("is-error");
        phoneNumber.classList.remove("is-error");
      });

      codeSelect.addEventListener("change", updatePhoneMeta);
      updatePhoneMeta();

      /* ------------------------------------------------------------
         Confirmation dialog
         ------------------------------------------------------------ */
      function openDialog() {
        overlay.hidden = false;
        document.body.classList.add("reservation-modal-open");
        closeBtn.focus();
      }

      function closeDialog() {
        overlay.hidden = true;
        document.body.classList.remove("reservation-modal-open");
      }

      form.addEventListener("submit", function (event) {
        event.preventDefault();

        var size = form.querySelector("#party-size");
        var checkedSlot = form.querySelector('input[name="time"]:checked');
        var clientName = form.querySelector("#client-name");
        var clientPhone = form.querySelector("#client-phone");

        if (!selectedKey) {
          daysGrid.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }

        if (!checkedSlot) {
          var firstSlot = slotsGrid.querySelector('input[name="time"]');
          if (firstSlot) firstSlot.focus();
          return;
        }

        if (!clientName.value.trim()) {
          clientName.focus();
          return;
        }

        var digits = phoneDigits(clientPhone.value);
        var country = currentCountry();
        var range = nsnRange(country);

        if (digits.length < range.min || digits.length > range.max) {
          phoneHint.classList.add("is-error");
          clientPhone.classList.add("is-error");
          clientPhone.focus();
          return;
        }

        var fullPhone = country.code + " " + groupDigits(digits);

        var sizeLabel = size.options[size.selectedIndex].text;

        /* "21 липня 2026, о 10:20" — genitive month, session start time,
           "об" before a vowel-initial hour (об 11:20), "о" otherwise */
        var MONTHS_GEN = [
          "січня", "лютого", "березня", "квітня", "травня", "червня",
          "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"
        ];
        var parts = selectedKey.split("-"); // YYYY-MM-DD
        var startTime = checkedSlot.value.split(" – ")[0];
        var atWord = startTime.indexOf("11:") === 0 ? "об" : "о";
        var dateLine =
          Number(parts[2]) + " " + MONTHS_GEN[Number(parts[1]) - 1] + " " +
          parts[0] + ", " + atWord + " " + startTime;

        var lines = [
          clientName.value.trim() + " - " + sizeLabel,
          dateLine,
          fullPhone
        ];

        summary.innerHTML = "";
        lines.forEach(function (text) {
          var line = document.createElement("span");
          line.className = "reservation-summary__line";
          line.textContent = text;
          summary.appendChild(line);
        });

        openDialog();
      });

      closeBtn.addEventListener("click", closeDialog);
      overlay.addEventListener("click", function (event) {
        if (event.target === overlay) closeDialog();
      });
      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && !overlay.hidden) closeDialog();
      });
    })();
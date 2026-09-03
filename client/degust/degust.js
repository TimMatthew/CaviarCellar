(function () {
      "use strict";

      var API_BASE = "/api";
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
      var calendarStatus = document.getElementById("calendar-status");
      var formStatus = document.getElementById("reservation-form-status");
      var submitButton = form.querySelector(".reservation-form__submit");

      var availability = Object.create(null);
      var availabilityRequest = 0;

      function apiErrorMessage(payload, fallback) {
        return payload && payload.error && payload.error.message
          ? payload.error.message
          : fallback;
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

      function renderCalendarDays(state) {
        state = state || {};
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
          var dayAvailability = availability[key];
          var free = dayAvailability ? dayAvailability.slots : [];
          var isFree = !isPast && !state.loading && !state.error && free.length > 0;
          var stateClass = isFree
            ? "calendar__day--free"
            : !isPast && state.loading
              ? "calendar__day--loading"
              : !isPast && state.error
                ? "calendar__day--unavailable"
                : "calendar__day--busy";

          var cell = document.createElement("button");
          cell.type = "button";
          cell.className = "calendar__day " + stateClass;
          cell.textContent = day;
          cell.dataset.key = key;

          if (isFree && key === selectedKey) cell.classList.add("is-selected");

          if (!isFree) {
            cell.disabled = true;
            cell.setAttribute(
              "aria-label",
              day + ": " + (
                isPast
                  ? "минула дата"
                  : state.loading
                    ? "завантаження доступності"
                    : state.error
                      ? "доступність тимчасово невідома"
                      : "всі сеанси зайняті"
              )
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

      async function loadAvailability() {
        var requestId = ++availabilityRequest;
        var from = dateKey(viewYear, viewMonth, 1);
        var lastDay = new Date(viewYear, viewMonth + 1, 0).getDate();
        var to = dateKey(viewYear, viewMonth, lastDay);

        availability = Object.create(null);
        daysGrid.setAttribute("aria-busy", "true");
        calendarStatus.textContent = "Завантажуємо доступні сеанси…";
        renderCalendarDays({ loading: true });

        try {
          var response = await fetch(
            API_BASE + "/degustations/availability?" +
            new URLSearchParams({ from: from, to: to }).toString(),
            { headers: { Accept: "application/json" } }
          );
          var payload = await response.json().catch(function () { return null; });
          if (!response.ok) {
            throw new Error(apiErrorMessage(payload, "Не вдалося завантажити доступність"));
          }
          if (requestId !== availabilityRequest) return;

          (payload.days || []).forEach(function (day) {
            availability[day.date] = day;
          });
          calendarStatus.textContent = "Доступні сеанси завантажено";
          renderCalendarDays();
        } catch (error) {
          if (requestId !== availabilityRequest) return;
          console.error(error);
          calendarStatus.textContent =
            "Не вдалося завантажити вільні сеанси. Спробуйте ще раз.";
          renderCalendarDays({ error: true });
        } finally {
          if (requestId === availabilityRequest) {
            daysGrid.removeAttribute("aria-busy");
          }
        }
      }

      function renderCalendar() {
        var selectedParts = selectedKey ? selectedKey.split("-") : null;
        if (
          selectedParts &&
          (Number(selectedParts[0]) !== viewYear || Number(selectedParts[1]) !== viewMonth + 1)
        ) {
          selectedKey = null;
          card.hidden = true;
        }
        loadAvailability();
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

        freeList.forEach(function (slot) {
          var label = document.createElement("label");
          label.className = "time-slot";

          var radio = document.createElement("input");
          radio.type = "radio";
          radio.name = "time";
          radio.value = slot.start;
          radio.dataset.label = slot.label;

          var text = document.createElement("span");
          text.className = "time-slot__text";
          text.textContent = slot.label;

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
        renderSlots(availability[selectedKey].slots);

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

      form.addEventListener("submit", async function (event) {
        event.preventDefault();

        var size = form.querySelector("#party-size");
        var checkedSlot = form.querySelector('input[name="time"]:checked');
        var clientName = form.querySelector("#client-name");
        var clientPhone = form.querySelector("#client-phone");
        var clientEmail = form.querySelector("#client-email");

        formStatus.textContent = "";
        formStatus.classList.remove("is-error", "is-success");
        clientName.classList.remove("is-error");
        clientEmail.classList.remove("is-error");

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
          clientName.classList.add("is-error");
          clientName.focus();
          return;
        }

        if (!clientEmail.checkValidity()) {
          clientEmail.classList.add("is-error");
          clientEmail.focus();
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

        var codeDigits = country.code.replace(/\D/g, "");
        var normalizedPhone = codeDigits + digits;
        var fullPhone = country.code + " " + groupDigits(digits);

        var sizeLabel = size.options[size.selectedIndex].text;

        /* "21 липня 2026, о 10:20" — genitive month, session start time,
           "об" before a vowel-initial hour (об 11:20), "о" otherwise */
        var MONTHS_GEN = [
          "січня", "лютого", "березня", "квітня", "травня", "червня",
          "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"
        ];
        var parts = selectedKey.split("-"); // YYYY-MM-DD
        var slotLabel = checkedSlot.dataset.label;
        var startTime = slotLabel.split(" – ")[0];
        var atWord = startTime.indexOf("11:") === 0 ? "об" : "о";
        var dateLine =
          Number(parts[2]) + " " + MONTHS_GEN[Number(parts[1]) - 1] + " " +
          parts[0] + ", " + atWord + " " + startTime;

        submitButton.disabled = true;
        submitButton.textContent = "Бронюємо…";
        formStatus.textContent = "Перевіряємо та зберігаємо бронювання…";

        try {
          var response = await fetch(API_BASE + "/degustations", {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              customer: {
                name: clientName.value.trim(),
                phone: normalizedPhone,
                email: clientEmail.value.trim()
              },
              date: checkedSlot.value,
              guestsAmount: Number(size.value)
            })
          });
          var payload = await response.json().catch(function () { return null; });
          if (!response.ok) {
            var bookingError = new Error(
              apiErrorMessage(payload, "Не вдалося створити бронювання")
            );
            bookingError.status = response.status;
            throw bookingError;
          }

          var bookedDateKey = selectedKey;
          var bookedStart = checkedSlot.value;
          var lines = [
            "Бронювання №" + payload.id,
            clientName.value.trim() + " - " + sizeLabel,
            dateLine,
            fullPhone,
            clientEmail.value.trim()
          ];

          summary.innerHTML = "";
          lines.forEach(function (text) {
            var line = document.createElement("span");
            line.className = "reservation-summary__line";
            line.textContent = text;
            summary.appendChild(line);
          });

          var bookedDay = availability[bookedDateKey];
          if (bookedDay) {
            bookedDay.slots = bookedDay.slots.filter(function (slot) {
              return slot.start !== bookedStart;
            });
            bookedDay.available = bookedDay.slots.length > 0;
          }

          form.reset();
          updatePhoneMeta();
          if (bookedDay && bookedDay.slots.length) {
            renderSlots(bookedDay.slots);
          } else {
            selectedKey = null;
            card.hidden = true;
          }
          renderCalendarDays();
          formStatus.textContent = "";
          openDialog();
        } catch (error) {
          console.error(error);
          if (error.status === 409) {
            formStatus.textContent =
              "Цей сеанс щойно забронювали. Оберіть інший вільний час.";
            await loadAvailability();
            if (selectedKey && availability[selectedKey]) {
              renderSlots(availability[selectedKey].slots);
              if (!availability[selectedKey].slots.length) {
                selectedKey = null;
                card.hidden = true;
              }
            }
          } else {
            formStatus.textContent =
              error.message || "Не вдалося створити бронювання. Спробуйте ще раз.";
          }
          formStatus.classList.add("is-error");
        } finally {
          submitButton.disabled = false;
          submitButton.textContent = "Забронювати столик";
        }
      });

      closeBtn.addEventListener("click", closeDialog);
      overlay.addEventListener("click", function (event) {
        if (event.target === overlay) closeDialog();
      });
      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && !overlay.hidden) closeDialog();
      });
    })();

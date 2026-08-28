/* Tudor Oltean — portfolio
   Mobile nav, active-section highlight, constellation draw, card tilt. */

(function () {
	'use strict';

	var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
	var coarse = window.matchMedia('(max-width: 736px)');

	/* ---------- mobile nav ---------- */

	var toggle = document.querySelector('.nav__toggle');
	var panel = document.getElementById('nav-panel');

	function setNav(open) {
		panel.classList.toggle('is-open', open);
		toggle.setAttribute('aria-expanded', String(open));
		toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
	}

	if (toggle && panel) {
		toggle.addEventListener('click', function () {
			setNav(toggle.getAttribute('aria-expanded') !== 'true');
		});

		panel.addEventListener('click', function (e) {
			if (e.target.tagName === 'A') setNav(false);
		});

		document.addEventListener('keydown', function (e) {
			if (e.key === 'Escape') setNav(false);
		});

		// Clicking outside the open panel closes it.
		document.addEventListener('click', function (e) {
			if (!panel.classList.contains('is-open')) return;
			if (panel.contains(e.target) || toggle.contains(e.target)) return;
			setNav(false);
		});

		// Leaving the mobile breakpoint drops the panel state.
		coarse.addEventListener('change', function (e) {
			if (!e.matches) setNav(false);
		});
	}

	/* ---------- active section in the nav ---------- */

	var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav__links a'));
	var sections = navLinks
		.map(function (a) {
			var id = a.getAttribute('href').slice(1);
			return document.getElementById(id === 'top' ? 'home' : id);
		})
		.filter(Boolean);

	if ('IntersectionObserver' in window && sections.length) {
		// Sections differ wildly in height, so comparing intersection ratios is
		// unreliable. Instead: watch a band near the top of the viewport and mark
		// the last section (in document order) currently crossing it.
		var crossing = new Set();

		function atBottom() {
			return window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
		}

		function syncActive() {
			var current = null;

			if (atBottom()) {
				// The last section is short enough to never reach the band.
				current = sections[sections.length - 1].id;
			} else {
				sections.forEach(function (section) {
					if (crossing.has(section.id)) current = section.id;
				});
			}
			if (!current) return;

			navLinks.forEach(function (a) {
				var href = a.getAttribute('href').slice(1);
				var target = href === 'top' ? 'home' : href;
				a.classList.toggle('is-active', target === current);
			});
		}

		var sectionObserver = new IntersectionObserver(
			function (entries) {
				entries.forEach(function (entry) {
					if (entry.isIntersecting) crossing.add(entry.target.id);
					else crossing.delete(entry.target.id);
				});
				syncActive();
			},
			{ threshold: 0, rootMargin: '-64px 0px -55% 0px' }
		);

		sections.forEach(function (section) {
			sectionObserver.observe(section);
		});

		addEventListener('scroll', syncActive, { passive: true });
	}

	/* ---------- constellation draw on scroll into view ---------- */

	var constellations = document.querySelectorAll('.constellation');

	if (reduceMotion.matches || !('IntersectionObserver' in window)) {
		constellations.forEach(function (svg) {
			svg.classList.add('is-drawn');
		});
	} else {
		var drawObserver = new IntersectionObserver(
			function (entries, observer) {
				entries.forEach(function (entry) {
					if (!entry.isIntersecting) return;
					entry.target.classList.add('is-drawn');
					observer.unobserve(entry.target); // draws once
				});
			},
			{ threshold: 0.15 }
		);

		constellations.forEach(function (svg) {
			drawObserver.observe(svg);
		});
	}

	/* ---------- card tilt ---------- */

	var MAX_X = 1.4; // deg
	var MAX_Y = 1.8; // deg

	function tiltEnabled() {
		return !reduceMotion.matches && !coarse.matches;
	}

	document.querySelectorAll('.tilt').forEach(function (card) {
		var frame = null;

		function reset() {
			if (frame) cancelAnimationFrame(frame);
			frame = null;
			card.style.transform = '';
		}

		card.addEventListener('pointermove', function (e) {
			if (!tiltEnabled() || e.pointerType !== 'mouse') return;
			if (frame) return;

			frame = requestAnimationFrame(function () {
				frame = null;
				var rect = card.getBoundingClientRect();
				var px = (e.clientX - rect.left) / rect.width - 0.5;  // -0.5 .. 0.5
				var py = (e.clientY - rect.top) / rect.height - 0.5;

				var rotX = (-py * 2 * MAX_X).toFixed(2);
				var rotY = (px * 2 * MAX_Y).toFixed(2);

				card.style.transform =
					'perspective(1200px) rotateX(' + rotX + 'deg) rotateY(' + rotY + 'deg) translateY(-6px)';
			});
		});

		card.addEventListener('pointerleave', reset);
		card.addEventListener('blur', reset);
	});
})();

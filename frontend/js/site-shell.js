(function(window, document) {
  'use strict';

  function getCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem('currentUser') || 'null');
    } catch (e) {
      return null;
    }
  }

  function injectStyles() {
    if (document.getElementById('siteShellStyles')) return;
    var style = document.createElement('style');
    style.id = 'siteShellStyles';
    style.textContent = '' +
      '.head-t .card .account-menu-item{position:relative;}' +
      '.head-t .card .account-menu-item>a{display:inline-block;}' +
      '.head-t .card .account-dropdown{display:none;position:absolute;top:100%;right:0;min-width:220px;background:#fff;border:1px solid #e5e7eb;box-shadow:0 16px 32px rgba(15,23,42,.12);padding:10px 0;z-index:9999;list-style:none;margin:8px 0 0;border-radius:14px;}' +
      '.head-t .card .account-menu-item:hover .account-dropdown,.head-t .card .account-menu-item.open .account-dropdown{display:block;}' +
      '.head-t .card .account-dropdown li{display:block;width:100%;}' +
      '.head-t .card .account-dropdown li a,.head-t .card .account-dropdown li span{display:block;padding:8px 16px;color:#334155;text-decoration:none;white-space:nowrap;}' +
      '.head-t .card .account-dropdown li a:hover{background:#f8fafc;color:#0f172a;}' +
      '.head-t .card .account-dropdown .account-name{font-weight:700;color:#0f172a;}' +
      '.head-t .card .account-dropdown .account-email{font-size:12px;color:#64748b;padding-top:0;}' +
      '.head-t .card .account-dropdown .divider{height:1px;background:#e2e8f0;margin:8px 0;}' +
      '@media (max-width:767px){.head-t .card .account-dropdown{left:0;right:auto;min-width:200px;}}';
    document.head.appendChild(style);
  }

  function updateOrderHistoryLinks() {
    var links = document.querySelectorAll('a[href="about.html"], a[href="order-history.html"]');
    Array.prototype.forEach.call(links, function(link) {
      var text = (link.textContent || '').toLowerCase();
      var icon = link.querySelector('.fa-file-text-o');
      if (text.indexOf('order history') !== -1 || icon) {
        link.setAttribute('href', 'order-history.html');
        var parent = link.parentNode;
        if (parent) parent.setAttribute('data-order-history-link', 'true');
      }
    });
  }

  function renderAccountMenu() {
    updateOrderHistoryLinks();
    injectStyles();

    var user = getCurrentUser();
    var card = document.querySelector('.head-t .card');
    if (!card) return;

    var loginLi = card.querySelector('a[href="login.html"]') ? card.querySelector('a[href="login.html"]').parentNode : null;
    var registerLi = card.querySelector('a[href="register.html"]') ? card.querySelector('a[href="register.html"]').parentNode : null;
    var shippingLi = card.querySelector('a[href="shipping.html"]') ? card.querySelector('a[href="shipping.html"]').parentNode : null;
    var existingAccount = card.querySelector('.account-menu-item');
    var orderHistoryLi = card.querySelector('[data-order-history-link="true"]');

    if (existingAccount) existingAccount.parentNode.removeChild(existingAccount);

    if (orderHistoryLi) orderHistoryLi.style.display = user ? 'none' : 'none';

    if (loginLi) loginLi.style.display = user ? 'none' : '';
    if (registerLi) registerLi.style.display = user ? 'none' : '';

    if (!user) return;

    var accountLi = document.createElement('li');
    accountLi.className = 'account-menu-item';
    accountLi.innerHTML = '' +
      '<a href="#" data-account-trigger="true"><i class="fa fa-user" aria-hidden="true"></i> Account</a>' +
      '<ul class="account-dropdown">' +
      '  <li><span class="account-name">' + escapeHtml(user.name || 'My Account') + '</span></li>' +
      '  <li><span class="account-email">' + escapeHtml(user.email || '') + '</span></li>' +
      '  <li class="divider"></li>' +
      '  <li><a href="order-history.html"><i class="fa fa-file-text-o" aria-hidden="true"></i> Order History</a></li>' +
      '  <li><a href="#" data-logout-link="true"><i class="fa fa-sign-out" aria-hidden="true"></i> Logout</a></li>' +
      '</ul>';

    if (shippingLi) {
      card.insertBefore(accountLi, shippingLi);
    } else {
      card.appendChild(accountLi);
    }

    var trigger = accountLi.querySelector('[data-account-trigger="true"]');
    var logoutLink = accountLi.querySelector('[data-logout-link="true"]');
    if (trigger) {
      trigger.addEventListener('click', function(event) {
        event.preventDefault();
        accountLi.classList.toggle('open');
      });
      document.addEventListener('click', function(event) {
        if (!accountLi.contains(event.target)) accountLi.classList.remove('open');
      });
    }
    if (logoutLink) {
      logoutLink.addEventListener('click', function(event) {
        event.preventDefault();
        localStorage.removeItem('currentUser');
        location.reload();
      });
    }
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  window.SiteShell = {
    renderAccountMenu: renderAccountMenu,
    getCurrentUser: getCurrentUser
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderAccountMenu);
  } else {
    renderAccountMenu();
  }
})(window, document);

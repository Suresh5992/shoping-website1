(function(window) {
  'use strict';

  var STATUS_ORDER = ['Pending', 'Shipped', 'Delivered'];

  function normalizeStatus(rawStatus, orderDate) {
    if (STATUS_ORDER.indexOf(rawStatus) !== -1) return rawStatus;

    var date = orderDate ? new Date(orderDate) : null;
    if (!date || isNaN(date.getTime())) return 'Pending';

    var ageMs = Date.now() - date.getTime();
    var ageDays = ageMs / (1000 * 60 * 60 * 24);

    if (ageDays >= 3) return 'Delivered';
    if (ageDays >= 1) return 'Shipped';
    return 'Pending';
  }

  function statusClass(status) {
    switch (status) {
      case 'Delivered': return 'label-success';
      case 'Shipped': return 'label-info';
      default: return 'label-warning';
    }
  }

  function enrichOrder(order) {
    if (!order) return order;
    var orderDate = order.date || order.created_at;
    order.status = normalizeStatus(order.status, orderDate);
    return order;
  }

  window.OrderUtils = {
    normalizeStatus: normalizeStatus,
    statusClass: statusClass,
    enrichOrder: enrichOrder
  };
})(window);

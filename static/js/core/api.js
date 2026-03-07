// core/api.js — Wrapper centralizzato per chiamate API

(function () {
  var BASE = '/api';

  function _headers() {
    return { 'Content-Type': 'application/json' };
  }

  function _handleError(res, endpoint) {
    if (!res.ok) {
      var err = new Error('API ' + res.status + ': ' + endpoint);
      err.status = res.status;
      throw err;
    }
    return res;
  }

  window.apiGet = async function (endpoint) {
    var res = await fetch(BASE + endpoint);
    _handleError(res, endpoint);
    return res.json();
  };

  window.apiPost = async function (endpoint, data) {
    var res = await fetch(BASE + endpoint, {
      method: 'POST',
      headers: _headers(),
      body: JSON.stringify(data),
    });
    _handleError(res, endpoint);
    return res.json();
  };

  window.apiPut = async function (endpoint, data) {
    var res = await fetch(BASE + endpoint, {
      method: 'PUT',
      headers: _headers(),
      body: JSON.stringify(data),
    });
    _handleError(res, endpoint);
    return res.json();
  };

  window.apiDelete = async function (endpoint) {
    var res = await fetch(BASE + endpoint, { method: 'DELETE' });
    _handleError(res, endpoint);
    return res.status === 204 ? null : res.json();
  };
})();

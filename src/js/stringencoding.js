'use strict';

// In the browser environment, we replace emailjs-stringencoding (which
// is very large) with the native classes.

module.exports = {
    TextEncoder: TextEncoder,
    TextDecoder: TextDecoder
};
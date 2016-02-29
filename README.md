Graymail
==========

Graymail is an email client for Chrome written in pure JavaScript. It's based on the now discontinued [Whiteout Mail](https://github.com/whiteout-io/mail), but without the encryption features of that app.

Graymail supports IMAP mailboxes and sending email over SMTP.

### Build from source

Clone the git repository

    git clone https://github.com/c-f-h/graymail.git

Build and generate the `dist/` directory:

    npm install && grunt

Then load the `dist/` directory as an unpacked extension in Chrome.

## License

    The MIT License (MIT)

    Copyright (c) 2014 Whiteout Networks GmbH.

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
    THE SOFTWARE.

### Third party libraries

The following open source libraries are used in this software:

* [OpenPGP.js](http://openpgpjs.org) (LGPL license): An implementation of OpenPGP in Javascript
* [email.js](http://emailjs.org) (MIT license): IMAP, SMTP, MIME-building and MIME-parsing engine
* [Forge](https://github.com/digitalbazaar/forge) (BSD license): An implementation of TLS in JavaScript

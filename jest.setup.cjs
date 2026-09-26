
require('@testing-library/jest-dom');

// jsPDF's UMD build uses the standard encoding APIs that jsdom does not expose by default.
const { TextDecoder, TextEncoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

import test from 'node:test';
import assert from 'node:assert/strict';
import { connectionQrOptions } from '../src/connection-qr.js';
import { readFileSync } from 'node:fs';

test('connection QR options render dark-on-light without a themed color override', () => {
    assert.equal(connectionQrOptions.width, 360);
    assert.equal(connectionQrOptions.margin, 4);
    assert.equal(connectionQrOptions.errorCorrectionLevel, 'M');
    assert.equal('color' in connectionQrOptions, false, 'inverted themed colors broke Android QR scanning');
});

test('both connection QR renderers share the dark-on-light options', () => {
    for (const file of ['Connections.tsx', 'DevicePairing.tsx']) {
        const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
        assert.match(source, /toDataURL\(invite\.uri,\s*connectionQrOptions\)/, `${file} must use connectionQrOptions`);
        assert.doesNotMatch(source, /designTokens/, `${file} must not theme the QR colors`);
    }
});

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRoomCode = generateRoomCode;
function generateRoomCode(nk) {
    var alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var code = '';
    var raw = nk.uuidv4().replace(/-/g, '');
    for (var i = 0; i < 6; i++) {
        var idx = parseInt(raw.substring(i * 2, i * 2 + 2), 16) % alphabet.length;
        code += alphabet[idx];
    }
    return code;
}

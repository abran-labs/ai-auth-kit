export class ProxyAccountError extends Error {
    code;
    name = "ProxyAccountError";
    constructor(code, message, options) {
        super(message, options);
        this.code = code;
    }
}
//# sourceMappingURL=hosted-types.js.map
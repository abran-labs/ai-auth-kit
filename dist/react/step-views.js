import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useId, useState } from "react";
function stepKind(step) {
    return step.kind;
}
export function SecretStepView(properties) {
    const inputId = useId();
    const [secret, setSecret] = useState("");
    return (_jsxs("form", { "data-aak-step": stepKind(properties.step), onSubmit: (event) => {
            event.preventDefault();
            properties.submit.onSecret(properties.step.flowId, secret);
            setSecret("");
        }, children: [_jsx("label", { htmlFor: inputId, children: properties.step.label }), _jsx("input", { autoFocus: true, "data-aak-secret-input": "", disabled: properties.disabled, id: inputId, onChange: (event) => {
                    setSecret(event.currentTarget.value);
                }, placeholder: properties.step.placeholder, type: "password", value: secret }), _jsx("button", { "data-aak-secret-submit": "", disabled: properties.disabled || secret === "", type: "submit", children: "Submit" }), _jsx("button", { "data-aak-cancel": "", disabled: properties.disabled, onClick: () => {
                    properties.submit.onCancel(properties.step.flowId);
                }, type: "button", children: "Cancel" })] }));
}
export function ConfirmRiskView(properties) {
    const checkboxId = useId();
    const [accepted, setAccepted] = useState(false);
    return (_jsxs("form", { "data-aak-step": stepKind(properties.step), onSubmit: (event) => {
            event.preventDefault();
            properties.submit.onConfirm(properties.step.flowId, accepted);
        }, children: [_jsx("p", { "data-aak-risk-message": "", children: properties.step.message }), _jsx("input", { autoFocus: true, checked: accepted, "data-aak-confirm-checkbox": "", disabled: properties.disabled, id: checkboxId, onChange: (event) => {
                    setAccepted(event.currentTarget.checked);
                }, type: "checkbox" }), _jsx("label", { htmlFor: checkboxId, children: "I understand the risk" }), _jsx("button", { "data-aak-confirm-submit": "", disabled: properties.disabled || !accepted, type: "submit", children: "Confirm" }), _jsx("button", { "data-aak-confirm-cancel": "", disabled: properties.disabled, onClick: () => {
                    properties.submit.onCancel(properties.step.flowId);
                }, type: "button", children: "Cancel" })] }));
}
export function RedirectPasteView(properties) {
    const inputId = useId();
    const [value, setValue] = useState("");
    const matches = value === "" || value.startsWith(properties.step.callbackPrefix);
    return (_jsxs("div", { "data-aak-step": stepKind(properties.step), children: [_jsx("button", { "data-aak-open-signin": "", onClick: () => {
                    window.open(properties.step.authorizationUrl, "_blank", "noopener");
                }, type: "button", children: "Open sign-in page" }), _jsx("p", { "data-aak-redirect-instructions": "", children: properties.step.instructions }), _jsxs("form", { onSubmit: (event) => {
                    event.preventDefault();
                    if (value.startsWith(properties.step.callbackPrefix)) {
                        properties.submit.onRedirect(properties.step.flowId, value);
                        setValue("");
                    }
                }, children: [_jsx("label", { htmlFor: inputId, children: "Paste the address from your browser" }), _jsx("input", { autoFocus: true, "data-aak-redirect-input": "", disabled: properties.disabled, id: inputId, onChange: (event) => {
                            setValue(event.currentTarget.value);
                        }, type: "text", value: value }), matches ? null : _jsx("span", { "data-aak-error": "", children: "Address must start with the callback prefix" }), _jsx("button", { "data-aak-redirect-submit": "", disabled: properties.disabled || !value.startsWith(properties.step.callbackPrefix), type: "submit", children: "Submit" }), _jsx("button", { "data-aak-cancel": "", disabled: properties.disabled, onClick: () => {
                            properties.submit.onCancel(properties.step.flowId);
                        }, type: "button", children: "Cancel" })] }), _jsxs("span", { "data-aak-redirect-expiry": "", "data-aak-muted": "", children: ["Expires ", properties.step.expiresAt] })] }));
}
export function WorkingView(properties) {
    return (_jsxs("div", { "data-aak-step": stepKind(properties.step), "data-aak-working": "", children: [_jsx("span", { role: "status", children: properties.step.message }), _jsx("button", { "data-aak-cancel": "", onClick: () => {
                    properties.onCancel(properties.step.flowId);
                }, type: "button", children: "Cancel" })] }));
}
//# sourceMappingURL=step-views.js.map
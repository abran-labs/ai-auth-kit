import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ConfirmRiskView, RedirectPasteView, SecretStepView, WorkingView, } from "./step-views.js";
export function FlowView(properties) {
    const step = properties.step;
    return (_jsxs("div", { "data-aak-flow": "", children: [step.kind === "secret-input" ? (_jsx(SecretStepView, { disabled: properties.disabled, step: step, submit: properties.submit })) : null, step.kind === "confirm-risk" ? (_jsx(ConfirmRiskView, { disabled: properties.disabled, step: step, submit: properties.submit })) : null, step.kind === "redirect-paste" ? (_jsx(RedirectPasteView, { disabled: properties.disabled, step: step, submit: properties.submit })) : null, step.kind === "working" ? (_jsx(WorkingView, { onCancel: properties.submit.onCancel, step: step })) : null, step.kind === "connected" ? _jsx("span", { "data-aak-step": "connected", children: "Connected" }) : null] }));
}
//# sourceMappingURL=connect-flow.js.map
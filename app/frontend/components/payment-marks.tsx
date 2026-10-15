import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBuildingColumns, faCreditCard, faMobileScreenButton } from "@fortawesome/free-solid-svg-icons";
import { faPaypal } from "@fortawesome/free-brands-svg-icons";

const methods = [
  { label: "Credit card", icon: faCreditCard, tone: "card" },
  { label: "Net banking", icon: faBuildingColumns, tone: "bank" },
  // The phone icon represents app-based UPI payments; the visible label makes the method clear.
  { label: "UPI", icon: faMobileScreenButton, tone: "upi" },
  { label: "PayPal", icon: faPaypal, tone: "paypal" },
];

export function PaymentMethods() {
  return (
    <ul className="payment-methods" aria-label="Accepted payment methods">
      {methods.map(method=><li className={`payment-method payment-${method.tone}`} key={method.label}><FontAwesomeIcon icon={method.icon} aria-hidden="true"/><span>{method.label}</span></li>)}
    </ul>
  );
}

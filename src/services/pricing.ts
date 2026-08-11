import { unlockPlans } from "../data/unlockPlans";

export type EditableUnlockPlan = {
  id: string;
  name: string;
  price: string;
  description: string;
  features: string[];
};

const pricingKey = "resume-job-fit-admin-pricing";

export function getDefaultPricePlans(): EditableUnlockPlan[] {
  return unlockPlans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    price: plan.price,
    description: plan.description,
    features: [...plan.features]
  }));
}

export function loadPricePlans(): EditableUnlockPlan[] {
  if (typeof window === "undefined") return getDefaultPricePlans();

  try {
    const raw = localStorage.getItem(pricingKey);
    if (!raw) return getDefaultPricePlans();
    const saved = JSON.parse(raw) as EditableUnlockPlan[];
    if (!Array.isArray(saved)) return getDefaultPricePlans();

    return getDefaultPricePlans().map((defaultPlan) => ({
      ...defaultPlan,
      ...saved.find((plan) => plan.id === defaultPlan.id),
      id: defaultPlan.id
    }));
  } catch {
    return getDefaultPricePlans();
  }
}

export function savePricePlans(plans: EditableUnlockPlan[]) {
  localStorage.setItem(pricingKey, JSON.stringify(plans));
  window.dispatchEvent(new Event("pricing-updated"));
}

export function resetPricePlans() {
  localStorage.removeItem(pricingKey);
  window.dispatchEvent(new Event("pricing-updated"));
  return getDefaultPricePlans();
}

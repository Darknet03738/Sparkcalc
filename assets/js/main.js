const panel = document.getElementById("quickPanel");
const backdrop = document.getElementById("quickBackdrop");
const openButton = document.getElementById("quickOpen");
const closeButton = document.getElementById("quickClose");
const voltageInput = document.getElementById("voltage");
const resistanceInput = document.getElementById("resistance");
const currentOutput = document.getElementById("current");

if (panel && backdrop && openButton && closeButton) {
function setPanel(open) {
  panel.classList.toggle("open", open);
  backdrop.classList.toggle("open", open);
  panel.setAttribute("aria-hidden", String(!open));
  openButton.setAttribute("aria-expanded", String(open));

  if (open) {
    closeButton.focus();
  } else {
    openButton.focus();
  }
}

function calculateCurrent() {
  const voltage = Number(voltageInput.value);
  const resistance = Number(resistanceInput.value);
  const isValid = resistance > 0 && Number.isFinite(voltage);

  currentOutput.textContent = isValid ? `${(voltage / resistance).toFixed(2)} A` : "—";
}

openButton.addEventListener("click", () => setPanel(true));
closeButton.addEventListener("click", () => setPanel(false));
backdrop.addEventListener("click", () => setPanel(false));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && panel.classList.contains("open")) {
    setPanel(false);
  }
});
}

if (voltageInput && resistanceInput && currentOutput) {
  voltageInput.addEventListener("input", calculateCurrent);
  resistanceInput.addEventListener("input", calculateCurrent);
}

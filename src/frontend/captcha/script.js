/* eslint-disable no-restricted-globals */
/* eslint-disable func-names */
/* eslint-disable no-undef */
/* eslint-disable camelcase */
const captcha_version = 17;
const captcha_label = document.currentScript.getAttribute("label");
const parameters = new URLSearchParams(document.location.search);
const captcha_enemies = Number.parseInt(parameters.get("enemies"), 10);
const user_id = Number.parseInt(parameters.get("user_id"), 10);

let captcha_html = "";
if (captcha_label) {
  captcha_html = `<p>${captcha_label}<br>`;
}

captcha_html += `<div style="position:relative; width:100%; height:0px; padding-bottom:56.25%;">
<iframe id="doom_captcha" src="captcha.html?version=${captcha_version}&countdown=${document.currentScript.getAttribute(
  "countdown",
)}&enemies=${captcha_enemies}&user_id=${user_id}" style="position:absolute; left:0; top:0; width:100%; height:100%"></iframe>
</div>`;

if (captcha_label) {
  captcha_html += "</p>";
}

document.write(captcha_html);

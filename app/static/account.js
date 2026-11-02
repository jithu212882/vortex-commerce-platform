/**
 * VORTEX COMMERCE - Dedicated Account Profile Client Engine
 * Flipkart/Amazon-Style Profile Tabs and Address Management
 */

(function () {
  "use strict";

  const el = {
    tabBtns: document.querySelectorAll(".account-nav-btn[data-tab]"),
    tabPanels: document.querySelectorAll(".account-tab-panel"),
    btnEditPersonalInfo: document.getElementById("btnEditPersonalInfo"),
    btnCancelEditProfile: document.getElementById("btnCancelEditProfile"),
    saveProfileBtnRow: document.getElementById("saveProfileBtnRow"),
    profileForm: document.getElementById("profileForm"),
    inputs: [
      document.getElementById("inputFirstName"),
      document.getElementById("inputLastName"),
      document.getElementById("inputEmail"),
      document.getElementById("inputMobile"),
    ],
    cartCountBadge: document.getElementById("cartCountBadge"),
    btnLogout: document.getElementById("btnLogout"),
  };

  function init() {
    bindTabs();
    bindProfileEditing();
    syncCartBadge();
  }

  function bindTabs() {
    el.tabBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetTab = btn.getAttribute("data-tab");
        el.tabBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        el.tabPanels.forEach((panel) => {
          if (panel.id === `tab-${targetTab}`) {
            panel.style.display = "block";
          } else {
            panel.style.display = "none";
          }
        });
      });
    });

    if (el.btnLogout) {
      el.btnLogout.addEventListener("click", () => {
        if (confirm("Are you sure you want to log out of your VORTEX account?")) {
          alert("Logged out successfully. Returning to public storefront.");
          window.location.href = "/";
        }
      });
    }
  }

  function bindProfileEditing() {
    if (el.btnEditPersonalInfo) {
      el.btnEditPersonalInfo.addEventListener("click", () => {
        el.inputs.forEach((input) => {
          if (input) {
            input.disabled = false;
            input.style.backgroundColor = "#FFFFFF";
          }
        });
        el.saveProfileBtnRow.style.display = "flex";
        el.btnEditPersonalInfo.style.display = "none";
      });
    }

    if (el.btnCancelEditProfile) {
      el.btnCancelEditProfile.addEventListener("click", () => {
        el.inputs.forEach((input) => {
          if (input) {
            input.disabled = true;
            input.style.backgroundColor = "#F8FAFC";
          }
        });
        el.saveProfileBtnRow.style.display = "none";
        el.btnEditPersonalInfo.style.display = "block";
      });
    }

    if (el.profileForm) {
      el.profileForm.addEventListener("submit", (e) => {
        e.preventDefault();
        el.inputs.forEach((input) => {
          if (input) {
            input.disabled = true;
            input.style.backgroundColor = "#F8FAFC";
          }
        });
        el.saveProfileBtnRow.style.display = "none";
        el.btnEditPersonalInfo.style.display = "block";
        alert("Profile details updated successfully.");
      });
    }
  }

  function syncCartBadge() {
    try {
      const stored = localStorage.getItem("vx_cart");
      if (stored && el.cartCountBadge) {
        const items = JSON.parse(stored);
        const count = items.reduce((acc, it) => acc + (it.quantity || 1), 0);
        el.cartCountBadge.textContent = count;
      }
    } catch (e) {}
  }

  window.addEventListener("DOMContentLoaded", init);
})();

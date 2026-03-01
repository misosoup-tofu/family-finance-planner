/* ===== Family Financial Planner - Calculation Engine ===== */

// --- State ---
let childCount = 0;
const MAX_CHILDREN = 3;
const PENSION_START_AGE = 65;
const BIRTH_ALLOWANCE = 50; // 出産育児一時金 50万円
const SIM_END_AGE = 100;

// Scenario storage
let savedScenarios = [];
const SCENARIO_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ec4899', '#06b6d4'];

// --- UI Helpers ---
function $(id) { return document.getElementById(id); }
function val(id) {
    const el = document.getElementById(id);
    if (!el) return 0;
    const v = parseFloat(el.value);
    return isNaN(v) ? 0 : v;
}

function calcNetIncome(gross) {
    if (gross <= 103) return gross;
    if (gross <= 300) return gross * 0.8;
    if (gross <= 600) return gross * 0.78;
    if (gross <= 900) return gross * 0.75;
    if (gross <= 1500) return gross * 0.7;
    return gross * 0.6;
}

/** 退職金の手取りを計算する（退職所得控除と1/2課税を考慮） */
function calcRetirementNet(bonusMan, years) {
    if (bonusMan <= 0) return 0;
    // 退職所得控除の計算
    let deduction = 0;
    if (years <= 20) {
        deduction = 40 * years;
        if (deduction < 80) deduction = 80; // 最低80万円
    } else {
        deduction = 800 + 70 * (years - 20);
    }
    const taxableIncome = Math.max(0, (bonusMan - deduction) / 2);
    if (taxableIncome <= 0) return bonusMan;

    // 所得税率（簡略化された累進税率）
    let taxRate = 0.05, taxDeductionAmt = 0;
    if (taxableIncome > 4000) { taxRate = 0.45; taxDeductionAmt = 479.6; }
    else if (taxableIncome > 1800) { taxRate = 0.40; taxDeductionAmt = 279.6; }
    else if (taxableIncome > 900) { taxRate = 0.33; taxDeductionAmt = 153.6; }
    else if (taxableIncome > 695) { taxRate = 0.23; taxDeductionAmt = 63.6; }
    else if (taxableIncome > 330) { taxRate = 0.20; taxDeductionAmt = 42.75; }
    else if (taxableIncome > 195) { taxRate = 0.10; taxDeductionAmt = 9.75; }

    const incomeTax = taxableIncome * taxRate - taxDeductionAmt;
    const residentTax = taxableIncome * 0.10; // 住民税一律10%
    return Math.round(bonusMan - incomeTax - residentTax);
}

/** 手取り額をリアルタイム表示 */
function updateNetIncomePreview() {
    const myGross = val('myIncome');
    const myAge = val('myAge');
    const partnerGross = val('partnerIncome');
    const partnerAge = val('partnerAge');

    const myHint = $('myNetIncomeHint');
    if (myHint) {
        if (myGross > 0) {
            const myNet = calcNetIncome(myGross, myAge);
            myHint.textContent = `手取り目安: 約${myNet.toLocaleString()}万円/年（月${Math.round(myNet / 12).toLocaleString()}万円）`;
        } else {
            myHint.textContent = '手取り目安: ー';
        }
    }

    const partnerHint = $('partnerNetIncomeHint');
    if (partnerHint) {
        if (partnerGross > 0) {
            const partnerNet = calcNetIncome(partnerGross, partnerAge);
            partnerHint.textContent = `手取り目安: 約${partnerNet.toLocaleString()}万円/年（月${Math.round(partnerNet / 12).toLocaleString()}万円）`;
        } else {
            partnerHint.textContent = '手取り目安: ー';
        }
    }
}

function toggleHousing() {
    $('housingDetails').classList.toggle('hidden', !$('housingToggle').checked);
}

function toggleHousingSellPrice() {
    const isManual = $('housingSellType').value === 'manual';
    $('housingSellManualDetails').classList.toggle('hidden', !isManual);
}

function toggleCar() {
    $('carDetails').classList.toggle('hidden', !$('carToggle').checked);
}

function toggleEarlyRetirement(who) {
    const id = who === 'my' ? 'myEarlyRetirementDetails' : 'partnerEarlyRetirementDetails';
    const checkId = who === 'my' ? 'myEarlyRetirement' : 'partnerEarlyRetirement';
    $(id).classList.toggle('hidden', !$(checkId).checked);
}

function toggleNisa() {
    $('nisaDetails').classList.toggle('hidden', !$('nisaToggle').checked);
}

function toggleNisaSell() {
    $('nisaSellDetails').classList.toggle('hidden', !$('nisaSellToggle').checked);
}

function toggleNisaSellType(index) {
    if (!index) return;
    const type = $(`nisaSellType${index}`).value;
    const isPartial = type === 'partial' || type === 'partial_annual';
    $(`nisaPartialDetails${index}`).classList.toggle('hidden', !isPartial);
}

function toggleIdeco() {
    $('idecoDetails').classList.toggle('hidden', !$('idecoToggle').checked);
}

function toggleWedding() {
    $('weddingDetails').classList.toggle('hidden', !$('weddingToggle').checked);
}

function toggleHousingType() {
    const type = document.querySelector('input[name="housingType"]:checked').value;
    const mgmtLabel = $('mgmtFeeLabel');
    if (mgmtLabel) {
        if (type === 'house') {
            mgmtLabel.textContent = '修繕積立（月額・自主）';
        } else {
            mgmtLabel.textContent = '管理費・修繕積立金（月額）';
        }
    }
}

function toggleJuku(checkbox) {
    const details = checkbox.closest('.juku-section').querySelector('.juku-details');
    if (checkbox.checked) {
        details.classList.remove('hidden');
        details.style.display = 'flex';
    } else {
        details.classList.add('hidden');
        details.style.display = 'none';
    }
}

function addChild(mode) {
    if (childCount >= MAX_CHILDREN) return;
    childCount++;
    const container = $('childrenContainer');
    const div = document.createElement('div');
    div.className = 'child-entry';
    div.id = `child-${childCount}`;
    div.dataset.mode = mode; // 'existing' or 'future'

    const isExisting = mode === 'existing';

    div.innerHTML = `
    <div class="child-header">
      <span class="child-label" style="font-weight:700; color:${isExisting ? '#34d399' : 'var(--accent)'};">第${childCount}子${isExisting ? '（既存）' : ''}</span>
      <button type="button" class="btn-remove" onclick="deleteChildEntry(this)">✕</button>
    </div>
    <div class="child-basic-row">
      ${isExisting
            ? `<label style="font-size:0.8rem;color:var(--text-secondary)">現在の年齢:</label>
           <div class="input-with-unit">
             <input type="number" class="child-age-input" min="0" max="22" value="3">
             <span class="unit">歳</span>
           </div>`
            : `<label style="font-size:0.8rem;color:var(--text-secondary)">何年後に出産:</label>
           <div class="input-with-unit">
             <input type="number" class="child-year-input" min="0" max="30" value="${childCount}">
             <span class="unit">年後</span>
           </div>`
        }
    </div>
    
    <!-- Education Paths -->
    <div class="education-grid">
      <div class="edu-stage">
        <label>幼稚園(3年)</label>
        <select class="edu-select edu-k" onchange="updateChildCostSummary()">
          <option value="public" selected>公立</option>
          <option value="private">私立</option>
        </select>
      </div>
      <div class="edu-stage">
        <label>小学校(6年)</label>
        <select class="edu-select edu-e" onchange="updateChildCostSummary()">
          <option value="public" selected>公立</option>
          <option value="private">私立</option>
        </select>
      </div>
      <div class="edu-stage">
        <label>中学校(3年)</label>
        <select class="edu-select edu-j" onchange="updateChildCostSummary()">
          <option value="public" selected>公立</option>
          <option value="private">私立</option>
        </select>
      </div>
      <div class="edu-stage">
        <label>高校(3年)</label>
        <select class="edu-select edu-h" onchange="updateChildCostSummary()">
          <option value="public" selected>公立</option>
          <option value="private">私立</option>
        </select>
      </div>
      <div class="edu-stage" style="align-items:flex-start;">
        <label>大学(4年)</label>
        <select class="edu-select edu-u" onchange="updateChildCostSummary()">
          <option value="national">国公立</option>
          <option value="private_art" selected>私立文系</option>
          <option value="private_sci">私立理系</option>
          <option value="none">行かない</option>
        </select>
        <div style="margin-top:0.3rem; display:flex; align-items:center; gap:0.2rem;">
            <input type="checkbox" class="edu-boarding" onchange="updateChildCostSummary()"> 
            <span style="font-size:0.75rem; white-space:nowrap;">下宿(仕送り)</span>
            <input type="number" class="edu-boarding-cost" value="10" step="1" style="width:40px; font-size:0.75rem; padding:0.1rem;" onchange="updateChildCostSummary()">
            <span style="font-size:0.75rem;">万/月</span>
        </div>
      </div>
    </div>

    <!-- Cram School (Juku) -->
    <div class="juku-section">
      <div style="display:flex; align-items:center; gap:0.5rem;">
        <label style="cursor:pointer; display:flex; align-items:center; gap:0.3rem;">
            <input type="checkbox" class="juku-toggle" onchange="toggleJuku(this); updateChildCostSummary()"> 塾に通う
        </label>
      </div>
      <div class="juku-details hidden" style="margin-left:auto; display:none;">
        <div class="input-with-unit" style="width:100px;">
           <input type="number" class="juku-cost" value="40" step="5"><span class="unit">万/年</span>
        </div>
        <select class="juku-start" style="width:60px;">
           <option value="12">中1</option>
           <option value="13" selected>中2</option>
           <option value="15">高1</option>
        </select>
        <span>〜</span>
        <select class="juku-end" style="width:60px;">
           <option value="12">小6</option>
           <option value="15">中3</option>
           <option value="18" selected>高3</option>
        </select>
      </div>
    </div>

    <!-- Cost Preview -->
    <div class="child-cost-preview" style="margin-top:0.5rem; padding:0.4rem 0.6rem; background:rgba(99,102,241,0.08); border-radius:6px; font-size:0.75rem; color:var(--text-secondary);">
      教育費目安: <span class="cost-estimate">計算中...</span>
    </div>
  `;
    container.appendChild(div);
    updateAddButton();
    updateChildCostSummary();
    if (typeof autoCalculate === 'function') autoCalculate();
}

function deleteChildEntry(btn) {
    btn.closest('.child-entry').remove();
    const entries = document.querySelectorAll('.child-entry');
    childCount = entries.length;
    entries.forEach((e, i) => {
        const isExisting = e.dataset.mode === 'existing';
        e.querySelector('.child-label').textContent = `第${i + 1}子${isExisting ? '（既存）' : ''}`;
        e.id = `child-${i + 1}`;
    });
    updateAddButton();
    updateChildCostSummary();
    if (typeof autoCalculate === 'function') autoCalculate();
}

function updateAddButton() {
    $('addChildBtn').style.display = childCount >= MAX_CHILDREN ? 'none' : '';
}

function showInput() {
    $('inputSection').classList.remove('hidden');
    $('resultsSection').classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- Feature 5: Presets ---
function loadPreset(type) {
    if (!confirm('現在の入力内容は上書きされます。よろしいですか？')) return;

    // Reset common
    $('myAge').value = 30;
    $('partnerAge').value = 28;
    $('currentSavings').value = 300;
    $('monthlyRent').value = 10;
    $('monthlyOther').value = 15;

    // Clear kids
    $('childrenContainer').innerHTML = '';
    childCount = 0;
    updateAddButton();

    if (type === 'standard') {
        $('myAge').value = 35; $('myIncome').value = 600;
        $('partnerAge').value = 33; $('partnerIncome').value = 100;
        $('currentSavings').value = 500;
        $('monthlyRent').value = 12;
        $('monthlyOther').value = 20;
        addChild('future'); // 1
        setTimeout(() => { // slight delay to ensure ID unique if needed, though sync is fine
            const rows = document.querySelectorAll('.child-entry');
            if (rows[0]) rows[0].querySelector('.child-year-input').value = 1;
            addChild('future'); // 2
            const rows2 = document.querySelectorAll('.child-entry');
            if (rows2[1]) rows2[1].querySelector('.child-year-input').value = 4;
            updateChildCostSummary();
        }, 50);
    } else if (type === 'dinks') {
        $('myAge').value = 30; $('myIncome').value = 800;
        $('partnerAge').value = 30; $('partnerIncome').value = 600;
        $('currentSavings').value = 1000;
        $('monthlyRent').value = 18;
        $('monthlyOther').value = 25;
        // No kids
    } else if (type === 'single') {
        $('myAge').value = 30; $('myIncome').value = 700;
        $('partnerAge').value = 30; $('partnerIncome').value = 0;
        $('currentSavings').value = 800;
        $('monthlyRent').value = 11;
        $('monthlyOther').value = 15;
        // No kids
    } else if (type === 'senior') {
        $('myAge').value = 60; $('myIncome').value = 500;
        $('partnerAge').value = 58; $('partnerIncome').value = 100;
        $('currentSavings').value = 2500;
        $('monthlyRent').value = 0; // Owned?
        $('monthlyOther').value = 18;
        $('myRetirementAge').value = 65;
        // No kids (grown up)
    }

    // Trigger calc
    setTimeout(() => {
        const data = runSimulation();
        if (data && !$('resultsSection').classList.contains('hidden')) {
            renderResults(data, true);
        }
    }, 100);
}

// --- Feature 3: Custom Events ---
function addCustomEvent() {
    const container = $('customEventsContainer');
    const div = document.createElement('div');
    div.className = 'custom-event-row';
    div.innerHTML = `
        <label>年齢</label>
        <div class="input-with-unit custom-event-age">
            <input type="number" class="evt-age" value="${parseInt($('myAge').value) + 5}">
            <span class="unit">歳</span>
        </div>
        <select class="evt-type">
            <option value="expense_once">臨時支出(1回)</option>
            <option value="income_once">臨時収入(1回)</option>
            <option value="expense_annual">支出増(毎年)</option>
            <option value="expense_reduce">支出減(毎年)</option>
            <option value="income_annual">収入増(毎年)</option>
        </select>
        <div class="input-with-unit custom-event-amount">
            <input type="number" class="evt-amount" value="100">
            <span class="unit">万円</span>
        </div>
        <input type="text" class="custom-event-name" placeholder="リフォーム、副業など" value="">
        <button type="button" class="btn-remove" onclick="this.parentElement.remove()">✕</button>
    `;
    container.appendChild(div);
}

function getCustomEvents() {
    const rows = document.querySelectorAll('.custom-event-row');
    return Array.from(rows).map(row => ({
        age: parseInt(row.querySelector('.evt-age').value) || 0,
        type: row.querySelector('.evt-type').value,
        amount: parseFloat(row.querySelector('.evt-amount').value) || 0,
        name: row.querySelector('.custom-event-name').value || 'イベント'
    }));
}

// --- Calc Helpers ---

/** 税込年収→手取り概算（万円） */
function calcNetIncome(grossMan, age = 0, dependents = 0) {
    if (grossMan <= 0) return 0;
    const gross = grossMan * 10000;

    // Social Insurance
    // Standard ~15% (Health 5%, Pension 9%, Emp 1%)
    // Age 40-64: Add Kaigo ~1.8% (Half is 0.9%) -> Total ~16-17%
    // Let's use 15% and 17% (simplified)
    const socialRate = (age >= 40 && age < 65) ? 0.17 : 0.15;
    const socialIns = gross * socialRate;

    // Income Tax (simplified progressive)
    // Deduction for Salary Income
    let salaryDeduction = 0;
    if (gross <= 1625000) salaryDeduction = 550000;
    else if (gross <= 1800000) salaryDeduction = gross * 0.4 - 100000;
    else if (gross <= 3600000) salaryDeduction = gross * 0.3 + 80000;
    else if (gross <= 6600000) salaryDeduction = gross * 0.2 + 440000;
    else if (gross <= 8500000) salaryDeduction = gross * 0.1 + 1100000;
    else salaryDeduction = 1950000;

    // Basic Deduction & Dependent Deduction
    // Basic: 480000
    // Spouse/Dependent: 380000 per person
    // Social Insurance Deduction: full amount
    const incomeDeduction = 480000 + (dependents * 380000) + socialIns;

    const taxableIncome = Math.max(0, gross - salaryDeduction - incomeDeduction);

    // Tax Rate (National)
    let taxRate = 0.05;
    let taxDeductionAmt = 0;
    if (taxableIncome > 40000000) { taxRate = 0.45; taxDeductionAmt = 4796000; }
    else if (taxableIncome > 18000000) { taxRate = 0.40; taxDeductionAmt = 2796000; }
    else if (taxableIncome > 9000000) { taxRate = 0.33; taxDeductionAmt = 1536000; }
    else if (taxableIncome > 6950000) { taxRate = 0.23; taxDeductionAmt = 636000; }
    else if (taxableIncome > 3300000) { taxRate = 0.20; taxDeductionAmt = 427500; }
    else if (taxableIncome > 1950000) { taxRate = 0.10; taxDeductionAmt = 97500; }

    const incomeTax = taxableIncome * taxRate - taxDeductionAmt;

    // Resident Tax (approx 10% of taxable income)
    // Basic deduction for resident tax is slightly different (430000), but simplified here.
    const residentTax = taxableIncome * 0.10;

    const net = gross - socialIns - incomeTax - residentTax;
    return Math.round(net / 10000);
}

// --- NISA Auto-Calc ---
function autoCalcNisaSell() {
    // 1. Calculate NISA Balance at retirement (simplified projection)
    // Assumption: Current Balance + Monthly * Years * Return
    const currentMy = val('nisaCurrentMy');
    const monthlyMy = val('nisaMonthlyMy');
    const returnMy = val('nisaReturnMy') / 100;
    const endAgeMy = val('nisaEndAgeMy');
    const currentAgeMy = val('myAge');

    const currentPartner = val('nisaCurrentPartner');
    const monthlyPartner = val('nisaMonthlyPartner');
    const returnPartner = val('nisaReturnPartner') / 100;
    const endAgePartner = val('nisaEndAgePartner');
    const currentAgePartner = val('partnerAge');

    // Project My NISA
    let balanceMy = currentMy;
    const yearsMy = Math.max(0, endAgeMy - currentAgeMy);
    for (let i = 0; i < yearsMy; i++) {
        balanceMy = (balanceMy + monthlyMy * 12) * (1 + returnMy);
    }
    // Growth after contribution stops? (Simulated until withdrawal start)
    // Let's assume withdrawal starts roughly at 65 or user defined start.
    // For "Die with Zero", we need to know WHEN they want to start selling.
    // Let's use the first slot's year as the start year.

    const sellYear1 = val('nisaSellYear1');
    if (sellYear1 <= 0) {
        alert('解約設定①の「解約時期」を設定してください（例：35年後）');
        return;
    }

    // Continue growth until sell year
    // Note: The above loop went to endAge. If sellYear > endAge, grow more. If sellYear < endAge, inaccurate but ok.
    // Let's restart projection properly to sellYear.
    balanceMy = currentMy;
    for (let i = 0; i < sellYear1; i++) {
        const age = currentAgeMy + i;
        const contrib = (age < endAgeMy) ? monthlyMy * 12 : 0;
        balanceMy = (balanceMy + contrib) * (1 + returnMy);
    }

    // Project Partner NISA (similar logic)
    let balancePartner = currentPartner;
    for (let i = 0; i < sellYear1; i++) {
        const age = currentAgePartner + i;
        const contrib = (age < endAgePartner) ? monthlyPartner * 12 : 0;
        balancePartner = (balancePartner + contrib) * (1 + returnPartner);
    }

    const totalBalance = balanceMy + balancePartner;

    // Die with Zero or Target Balance
    // Target: Partner's Age 100
    const targetAgePartner = 100;
    const startAgePartner = currentAgePartner + sellYear1;
    const yearsToDeplete = Math.max(1, targetAgePartner - startAgePartner);

    // Future Value (Target Balance)
    const targetBalance = val('nisaTargetBalance');

    // Simple Annuity Formula (PMT) with FV
    // PV = PMT * (1 - (1+r)^-n) / r + FV / (1+r)^n
    // PMT = (PV - FV / (1+r)^n) * r / (1 - (1+r)^-n)

    // Rate: Average return or safe rate? 
    // Using user's "My Return" as baseline for projection during withdrawal phase too?
    // Or conservative? Let's use the average of My+Partner settings as the portfolio return.
    const avgReturn = (returnMy + returnPartner) / 2 || 0.03;

    let pmt = 0;
    if (avgReturn === 0) {
        pmt = (totalBalance - targetBalance) / yearsToDeplete;
    } else {
        const pvOfTarget = targetBalance / Math.pow(1 + avgReturn, yearsToDeplete);
        const presentValueForAnnuity = totalBalance - pvOfTarget;

        // If PV is essentially negative (Target > Potential Growth), PMT is negative (meaning we need to SAVE more, not withdraw).
        // But here we assume withdrawal.
        if (presentValueForAnnuity <= 0) {
            pmt = 0; // Cannot withdraw if we want to hit that target with current funds
        } else {
            pmt = presentValueForAnnuity * avgReturn / (1 - Math.pow(1 + avgReturn, -yearsToDeplete));
        }
    }

    // Ensure non-negative
    pmt = Math.max(0, pmt);

    // Set values
    // Note: To support annual withdrawal properly, we ideally need 'partial_annual'.
    // If the select option doesn't exist in HTML yet, this value setting won't work fully in UI (hidden), 
    // but the logic in runSimulation might need 'partial_annual' support if not present.
    // I previously assumed I'd add 'partial_annual'. I will check/add it.

    $('nisaSellType1').value = 'partial_annual';
    // Fallback if 'partial_annual' option doesn't exist? (It should be added)

    $('nisaSellAmount1').value = Math.round(pmt);
    toggleNisaSellType(1);

    alert(`パートナーが100歳時点で残高${targetBalance}万円を残すための取崩額（年額）を計算しました。\n約 ${Math.round(pmt)} 万円/年 を設定しました。\n(期間: ${yearsToDeplete}年間, 想定利回り${(avgReturn * 100).toFixed(1)}%)`);
}

/** 住宅ローン控除（年額・万円） */
function calcMortgageTaxDeduction(loanBalance, yearCount, isMansion) {
    // 2024年以降入居の省エネ基準適合住宅の例（一般住宅は0が多いが、ここでは甘めに設定）
    // 借入限度額: 3000万円(一般) ~ 5000万円(長期優良)
    // 控除率: 0.7%
    // 期間: 13年
    if (yearCount > 13) return 0;

    // 簡略化: 全期間0.7%、残高上限4000万円とする
    const cappedBalance = Math.min(loanBalance, 4000);
    const deduction = cappedBalance * 0.007;
    return Math.round(deduction);
}

/** 育休手当の年額（万円） */
function calcParentalLeaveAllowance(grossMan, monthsIntoLeave, monthsThisYear) {
    const monthlySalary = (grossMan * 10000) / 12;
    const dailyWage = monthlySalary / 30;
    const cappedDaily = Math.min(dailyWage, 15430);
    let total = 0;
    for (let m = 0; m < monthsThisYear; m++) {
        const currentMonth = monthsIntoLeave + m;
        const rate = currentMonth < 6 ? 0.67 : 0.50;
        total += cappedDaily * 30 * rate;
    }
    return Math.round(total / 10000);
}

/** 住宅ローン年間返済額（万円）: 元利均等 */
function calcAnnualMortgage(principal, years, ratePercent) {
    if (principal <= 0 || years <= 0) return 0;
    const r = ratePercent / 100 / 12;
    const n = years * 12;
    if (r === 0) return Math.round(principal / years);
    const monthly = principal * 10000 * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
    return Math.round(monthly * 12 / 10000);
}

/** 児童手当（年額・万円） 新制度(2024年10月～)対応 */
function calcChildAllowance(childAge, rankUnder23) {
    if (childAge < 0 || childAge > 18) return 0; // 18歳到達後の3月まで（ここでは18歳までとする）
    if (rankUnder23 >= 3) return 36; // 第3子以降（多子加算）
    if (childAge < 3) return 18; // 3歳未満
    return 12; // 3歳〜18歳
}

/** 教育費（年額・万円）— base amount before inflation */
/** 詳細教育費（年額・万円） */
function calcEducationCostDetailed(childAge, edu, juku) {
    if (childAge < 3) return 0;

    let tuition = 0;
    // School Stage
    if (childAge >= 3 && childAge <= 5) { // Kindergarten
        tuition = edu.k === 'private' ? 30 : 0;
    } else if (childAge >= 6 && childAge <= 11) { // Elementary
        tuition = edu.e === 'private' ? 160 : 32;
    } else if (childAge >= 12 && childAge <= 14) { // Jr High
        tuition = edu.j === 'private' ? 140 : 49;
    } else if (childAge >= 15 && childAge <= 17) { // High School
        tuition = edu.h === 'private' ? 97 : 46;
    } else if (childAge >= 18 && childAge <= 21) { // University
        if (edu.u === 'national') tuition = 110;
        else if (edu.u === 'private_art') tuition = 130;
        else if (edu.u === 'private_sci') tuition = 170;
        else tuition = 0;

        if (edu.boarding && edu.u !== 'none') {
            tuition += edu.boardingCost * 12;
        }
    }

    let jukuCost = 0;
    if (juku.active) {
        if (childAge >= juku.start && childAge <= juku.end) {
            jukuCost = juku.cost;
        }
    }

    return Math.round(tuition + jukuCost);
}

// --- Child Cost Preview (total education estimate) ---
function calcChildTotalCostPreview(edu, juku) {
    let total = 0;
    for (let age = 0; age <= 22; age++) {
        total += calcEducationCostDetailed(age, edu, juku);
    }
    return Math.round(total);
}

function updateChildCostSummary() {
    const entries = document.querySelectorAll('.child-entry');
    entries.forEach((entry, i) => {
        const edu = {
            k: entry.querySelector('.edu-k') ? entry.querySelector('.edu-k').value : 'public',
            e: entry.querySelector('.edu-e') ? entry.querySelector('.edu-e').value : 'public',
            j: entry.querySelector('.edu-j') ? entry.querySelector('.edu-j').value : 'public',
            h: entry.querySelector('.edu-h') ? entry.querySelector('.edu-h').value : 'public',
            u: entry.querySelector('.edu-u') ? entry.querySelector('.edu-u').value : 'national',
            boarding: entry.querySelector('.edu-boarding') ? entry.querySelector('.edu-boarding').checked : false,
            boardingCost: entry.querySelector('.edu-boarding-cost') ? parseFloat(entry.querySelector('.edu-boarding-cost').value) || 0 : 0
        };
        const jukuToggle = entry.querySelector('.juku-toggle');
        const juku = {
            active: jukuToggle ? jukuToggle.checked : false,
            cost: parseFloat(entry.querySelector('.juku-cost')?.value) || 0,
            start: parseInt(entry.querySelector('.juku-start')?.value) || 13,
            end: parseInt(entry.querySelector('.juku-end')?.value) || 18
        };
        const total = calcChildTotalCostPreview(edu, juku);
        const preview = entry.querySelector('.cost-estimate');
        if (preview) preview.textContent = `約${total.toLocaleString()}万円`;
    });

    // Update summary card
    const summaryEl = $('childCostSummary');
    if (entries.length === 0) {
        summaryEl.style.display = 'none';
        return;
    }
    summaryEl.style.display = 'block';
    let html = '<div style="font-size:0.78rem; color:var(--text-secondary); margin-bottom:0.5rem;">💡 <strong>教育費の内訳目安</strong>（インフレ前）</div>';
    html += '<div style="font-size:0.72rem; color:var(--text-secondary);">';
    html += '幼稚園(3年) → 小学校(6年) → 中学(3年) → 高校(3年) → 大学(4年) + 塾代';
    html += '</div>';
    summaryEl.innerHTML = html;
}

// --- Pension Auto-Calc ---
function calcPensionEstimate(grossIncome, pensionType, retirementAge, currentAge) {
    const BASE_PENSION = 78; // 基礎年金 約78万円/年 (満額40年加入)
    const workYears = Math.min(retirementAge - 22, 40); // 22歳から加入想定

    if (pensionType === 'dependent') {
        // 第3号被保険者: 基礎年金のみ
        return Math.round(BASE_PENSION * Math.min(workYears, 40) / 40);
    }
    if (pensionType === 'national') {
        // 国民年金のみ
        return Math.round(BASE_PENSION * Math.min(workYears, 40) / 40);
    }
    // 厚生年金: 基礎年金 + 報酬比例部分
    // 平均標準報酬月額 = 年収 / 12 (万円)
    // 報酬比例 = 平均標準報酬月額 × 5.481/1000 × 加入月数
    const avgMonthlyPay = grossIncome / 12; // 万円
    const months = workYears * 12;
    const proportional = avgMonthlyPay * 5.481 / 1000 * months;
    const basePart = BASE_PENSION * Math.min(workYears, 40) / 40;
    return Math.round(basePart + proportional);
}

function autoCalcPension(who) {
    const income = who === 'my' ? val('myIncome') : val('partnerIncome');
    const retAge = who === 'my' ? val('myRetirementAge') : val('partnerRetirementAge');
    const age = who === 'my' ? val('myAge') : val('partnerAge');
    const pensionType = who === 'my' ? $('myPensionType').value : $('partnerPensionType').value;
    const estimate = calcPensionEstimate(income, pensionType, retAge, age);
    const targetId = who === 'my' ? 'myPension' : 'partnerPension';
    $(targetId).value = estimate;
    if (typeof autoCalculate === 'function') autoCalculate();
}

// --- Housing Tax Auto-Calc ---
function autoCalcHousingTax() {
    const price = val('housingPrice') * 10000;
    // Rule of thumb: Fixed Asset Tax approx 0.24% of market price (0.0024)
    // 5000万 -> 12万
    const estimatedTax = Math.round(price * 0.0024);
    if ($('housingTax')) $('housingTax').value = estimatedTax;
}

// --- Main Simulation ---
function runSimulation() {
    // 1. Basic Validation
    const rawInputs = document.querySelectorAll('#planForm input[type="number"]');
    for (let i = 0; i < rawInputs.length; i++) {
        const input = rawInputs[i];
        if (!input.checkValidity()) {
            alert(`入力エラー: 「${input.previousElementSibling?.textContent || input.id}」の値が不正です。正しい数値を入力してください。`);
            input.focus();
            return; // Stop simulation
        }
    }

    // Cumulative Tracking for Pie Chart
    let lifetimeExpenses = {
        housing: 0,
        education: 0,
        living: 0,
        car: 0,
        insurance: 0,
        care: 0,
        taxes: 0,
        investment: 0,
        other: 0
    };

    // Basic info
    const myAge = val('myAge');
    const partnerAge = val('partnerAge');
    const myGrossBase = val('myIncome');
    const partnerGrossBase = val('partnerIncome');
    const currentSavings = val('currentSavings');
    const emergencyFund = val('emergencyFund');
    const monthlyRent = val('monthlyRent');
    const monthlyOther = val('monthlyOther');
    const annualSpecialBase = val('annualSpecial');

    // Economic assumptions
    const inflationRate = val('inflationRate') / 100;
    const baseSalaryGrowthRate = val('salaryGrowth') / 100;
    const effectiveSalaryGrowthRate = baseSalaryGrowthRate + inflationRate;
    const rentInflationRate = val('rentInflation') / 100;

    // Retirement
    const myRetAge = val('myRetirementAge');
    const myRetBonus = val('myRetirementBonus');
    const partnerRetAge = val('partnerRetirementAge');
    const partnerRetBonus = val('partnerRetirementBonus');
    const myPension = val('myPension');
    const partnerPension = val('partnerPension');
    const pensionMacroSlide = parseFloat(val('pensionMacroSlide') || 0) / 100;

    const myCorporatePension = val('myCorporatePension');
    const myCorpStart = val('myCorporatePensionStart');
    const myCorpDuration = val('myCorporatePensionDuration');
    const partnerCorporatePension = val('partnerCorporatePension');
    const partnerCorpStart = val('partnerCorporatePensionStart');
    const partnerCorpDuration = val('partnerCorporatePensionDuration');

    // Separate leave durations
    const myLeaveDuration = val('myLeaveDuration');
    const partnerLeaveDuration = val('partnerLeaveDuration');

    // Career Change / Early Retirement
    const myEarlyQuit = $('myEarlyRetirement').checked;
    const myQuitAge = myEarlyQuit ? val('myQuitAge') : 999;
    const myQuitIncome = myEarlyQuit ? val('myQuitIncome') : 0;

    const partnerEarlyQuit = $('partnerEarlyRetirement').checked;
    const partnerQuitAge = partnerEarlyQuit ? val('partnerQuitAge') : 999;
    const partnerQuitIncome = partnerEarlyQuit ? val('partnerQuitIncome') : 0;

    // Insurance
    const lifeInsurance = val('lifeInsurance');
    const insuranceEndAge = val('insuranceEndAge');

    // Medical / Nursing
    const elderlyMedical = val('elderlyMedical');
    const elderlyMedical75 = val('elderlyMedical75');
    const nursingCostTotal = val('nursingCost');
    const nursingAnnual = nursingCostTotal / 10;

    // Old NISA/iDeCo params removed (moved to detailed init below)

    // Children (Detailed Inputs)
    const childEntries = document.querySelectorAll('.child-entry');
    const children = [];
    childEntries.forEach(entry => {
        const isExisting = entry.dataset.mode === 'existing';
        let birthYear;
        if (isExisting) {
            const currentAge = parseFloat(entry.querySelector('.child-age-input')?.value) || 0;
            birthYear = -currentAge; // negative = born in the past
        } else {
            const yearsLater = parseFloat(entry.querySelector('.child-year-input')?.value) || 0;
            birthYear = yearsLater;
        }

        // Education Paths
        const edu = {
            k: entry.querySelector('.edu-k') ? entry.querySelector('.edu-k').value : 'public',
            e: entry.querySelector('.edu-e') ? entry.querySelector('.edu-e').value : 'public',
            j: entry.querySelector('.edu-j') ? entry.querySelector('.edu-j').value : 'public',
            h: entry.querySelector('.edu-h') ? entry.querySelector('.edu-h').value : 'public',
            u: entry.querySelector('.edu-u') ? entry.querySelector('.edu-u').value : 'national',
        };

        // Juku
        const jukuToggle = entry.querySelector('.juku-toggle');
        const juku = {
            active: jukuToggle ? jukuToggle.checked : false,
            cost: parseFloat(entry.querySelector('.juku-cost')?.value) || 0,
            start: parseInt(entry.querySelector('.juku-start')?.value) || 13,
            end: parseInt(entry.querySelector('.juku-end')?.value) || 18
        };

        children.push({ birthYear, edu, juku, isExisting });
    });

    // Housing (Detailed Inputs)
    const hasHousing = $('housingToggle').checked;
    let housingYearOffset = 0, housingPrice = 0, housingDown = 0, loanYears = 0, loanRate = 0;
    let housingMgmtFee = 0, housingTax = 0, housingFee = 0;
    let housingDepreciation = 0, housingMaintenanceCost = 0, housingMaintenanceFreq = 0;

    // Home Sale
    let housingSellAge = 999;
    let housingSellType = 'auto';
    let housingSellManualPrice = 0;
    let isHouseSold = false;

    const mortgageReviews = getMortgageReviews();

    if (hasHousing) {
        housingYearOffset = val('housingYear');
        housingPrice = val('housingPrice');
        housingDown = val('housingDown');
        loanYears = val('loanYears');
        loanRate = val('loanRate');
        housingMgmtFee = val('housingManagementFee'); // monthly
        housingTax = val('housingTax'); // annual
        housingFee = val('housingFee');
        housingDepreciation = val('housingDepreciation') / 100;
        housingMaintenanceCost = val('housingMaintenanceCost');
        housingMaintenanceFreq = val('housingMaintenanceFreq');

        housingSellAge = val('housingSellAge');
        housingSellType = $('housingSellType').value;
        housingSellManualPrice = val('housingSellManualPrice');
    }
    const mortgagePrincipal = housingPrice - housingDown;
    const annualMortgage = hasHousing ? calcAnnualMortgage(mortgagePrincipal, loanYears, loanRate) : 0;

    // Car
    const hasCar = $('carToggle').checked;
    let carPrice = 0, carCycle = 7, carMaintenance = 0;
    let carCompactPrice = 0, carDownsize = false;
    let carCurrentAge = 0;
    let carCount = 1;

    if (hasCar) {
        carCount = parseInt(val('carCount')) || 1;
        carPrice = val('carPrice') * carCount;
        carCycle = val('carCycle') || 7;
        carMaintenance = val('carMaintenance') * carCount;
        carDownsize = $('carDownsizeToggle').checked;
        carCompactPrice = (carDownsize ? val('carCompactPrice') : val('carPrice')) * carCount;
        carCurrentAge = val('carCurrentAge') || 0;
    }
    let carEndAge = val('carEndAgeInput');
    if (carEndAge === 0) carEndAge = 999;
    if (window.__carEndAgeOverride !== undefined) {
        carEndAge = window.__carEndAgeOverride;
    }

    // Wedding / Grandchild costs
    const hasWedding = $('weddingToggle').checked;
    const weddingGiftAmt = hasWedding ? val('weddingGift') : 0;
    const grandchildBirthGiftAmt = hasWedding ? val('grandchildBirthGift') : 0;
    const grandchildSupportAmt = hasWedding ? val('grandchildSupport') : 0;

    // Elderly Care (New)
    // Input is now "Household Total", so we divide by 2 to apply per person (if both alive)
    const elderlyMedicalMonthly = val('elderlyMedicalMonthly') / 2;
    const nursingMonthlyCap = val('nursingMonthlyCap') / 2;
    const nursingStartAge = val('nursingStartAge');

    // Parent Care
    const hasParentCare = $('parentCareToggle') ? $('parentCareToggle').checked : false;
    const parentCareStartAge = val('parentCareStartAge');
    const parentCareDuration = val('parentCareDuration');
    const parentCareInitial = val('parentCareInitial');
    const parentCareMonthly = val('parentCareMonthly');

    // Build year-by-year data
    const years = SIM_END_AGE - myAge + 1;
    const data = [];
    let cumulativeAsset = currentSavings;

    // Track Principal for Profit Calculation (Split)
    let nisaBalanceMy = 0, nisaBalancePartner = 0;
    let nisaPrincipalMy = 0, nisaPrincipalPartner = 0;

    // NISA Init
    if ($('nisaToggle').checked) {
        nisaBalanceMy = val('nisaCurrentMy');
        nisaBalancePartner = val('nisaCurrentPartner');
        nisaPrincipalMy = nisaBalanceMy;
        nisaPrincipalPartner = nisaBalancePartner;
    }
    let nisaBalance = nisaBalanceMy + nisaBalancePartner; // helper for aggregate tracking
    let nisaBalanceOpt = nisaBalance;
    let nisaBalancePes = nisaBalance;

    // iDeCo Init (Split)
    let idecoBalanceMy = 0, idecoBalancePartner = 0;
    let idecoPrincipalMy = 0, idecoPrincipalPartner = 0;
    let idecoReceivedMy = false, idecoReceivedPartner = false;
    let idecoReceived = false; // flag for ANY received or finish? (mostly for chart stacking logic)

    if ($('idecoToggle').checked) {
        idecoBalanceMy = val('idecoCurrentMy');
        idecoPrincipalMy = idecoBalanceMy;

        if ($('idecoPartnerActive').checked) {
            idecoBalancePartner = val('idecoCurrentPartner');
            idecoPrincipalPartner = idecoBalancePartner;
        } else {
            idecoBalancePartner = 0;
            idecoPrincipalPartner = 0;
        }
    }
    let idecoBalance = idecoBalanceMy + idecoBalancePartner;

    // Parse NISA Sell Configs
    const nisaSellConfigs = [];
    if ($('nisaSellToggle').checked) {
        for (let k = 1; k <= 3; k++) {
            const yOffset = val(`nisaSellYear${k}`);
            if (yOffset > 0) {
                nisaSellConfigs.push({
                    yearOffset: yOffset,
                    type: $(`nisaSellType${k}`).value,
                    amount: val(`nisaSellAmount${k}`)
                });
            }
        }
    }

    for (let y = 0; y < years; y++) {
        const currentMyAge = myAge + y;
        const currentPartnerAge = partnerAge + y;
        const calendarYear = new Date().getFullYear() + y;
        const events = [];
        let yearIncome = 0;
        let yearExpense = 0;

        // Detailed Breakdown Initialization
        let breakdown = {
            income: {
                salaryMy: 0,
                salaryPartner: 0,
                pensionMy: 0,
                pensionPartner: 0,
                other: 0,
                assetReturn: 0
            },
            expense: {
                living: 0,
                housing: 0,
                education: 0,
                car: 0,
                insurance: 0,
                care: 0,
                event: 0,
                investment: 0,
                other: 0
            },
            investmentGrowth: 0
        };

        // --- Inflation multiplier ---
        const inflationMult = Math.pow(1 + inflationRate, y);

        // --- Salary Calculation (Career Change Logic) ---
        // Self
        let myCurrentGross = 0;
        if (currentMyAge < Math.min(myRetAge, myQuitAge)) {
            // Normal career
            const myGrowthYears = Math.min(y, Math.max(0, 50 - myAge));
            myCurrentGross = myGrossBase * Math.pow(1 + effectiveSalaryGrowthRate, myGrowthYears);
        } else if (currentMyAge < myRetAge && currentMyAge >= myQuitAge) {
            // Career change period
            myCurrentGross = myQuitIncome; // Fixed income after quit
        }

        // Partner
        let partnerCurrentGross = 0;
        if (currentPartnerAge < Math.min(partnerRetAge, partnerQuitAge)) {
            const pGrowthYears = Math.min(y, Math.max(0, 50 - partnerAge));
            partnerCurrentGross = partnerGrossBase * Math.pow(1 + effectiveSalaryGrowthRate, pGrowthYears);
        } else if (currentPartnerAge < partnerRetAge && currentPartnerAge >= partnerQuitAge) {
            partnerCurrentGross = partnerQuitIncome;
        }

        // --- Work Status & Dependents ---
        let myWorking = myCurrentGross > 0;
        let myOnLeave = false;
        let partnerWorking = partnerCurrentGross > 0;
        let partnerOnLeave = false;

        // Count Dependents (simplified: generally under 23)
        // Note: Spouse deduction if partner income is low (< 103 simplified to 150 for safety margin in logic or strictly 103)
        // Here we assume if partnerGross < 103, they are dependent.
        let myDependents = 0;
        let partnerDependents = 0;

        // Spouse Deduction
        if (myWorking && partnerCurrentGross <= 103) {
            myDependents++;
        } else if (partnerWorking && myCurrentGross <= 103) {
            partnerDependents++;
        }

        // Child Deduction (Allocation to higher earner)
        let childDependents = 0;
        children.forEach(c => {
            const age = y - c.birthYear;
            if (age >= 0 && age <= 22) { // 16-22 is technically the deduction range, but <16 has other benefits. 
                // For 'calcNetIncome' which uses a generic deduction, applying it for all kids is a fair approximation of various benefits
                // actually <16 has no income tax deduction (child allowance instead), but >=16 does.
                // Let's stick to >=16 for accurate tax deduction, as Child Allowance is added separately.
                if (age >= 16) childDependents++;
            }
        });

        if (myCurrentGross >= partnerCurrentGross) {
            myDependents += childDependents;
        } else {
            partnerDependents += childDependents;
        }

        // Check parental leave for each child (independent durations)
        let myLeaveMonthsThisYear = 0;
        let partnerLeaveMonthsThisYear = 0;

        children.forEach((child) => {
            const childAge = y - child.birthYear;
            // Skip parental leave for existing children (already happened)
            if (child.isExisting) return;
            if (childAge >= 0) {
                // Self
                const monthsSinceBirth = childAge * 12;
                if (myLeaveDuration > monthsSinceBirth) {
                    const remaining = myLeaveDuration - monthsSinceBirth;
                    const leaveInThisYear = Math.min(12, remaining);
                    myLeaveMonthsThisYear = Math.max(myLeaveMonthsThisYear, leaveInThisYear);
                }
                // Partner
                if (partnerLeaveDuration > monthsSinceBirth) {
                    const remaining = partnerLeaveDuration - monthsSinceBirth;
                    const leaveInThisYear = Math.min(12, remaining);
                    partnerLeaveMonthsThisYear = Math.max(partnerLeaveMonthsThisYear, leaveInThisYear);
                }
            }
        });

        if (myLeaveMonthsThisYear > 0) myOnLeave = true;
        if (partnerLeaveMonthsThisYear > 0) partnerOnLeave = true;

        // Income Calculation
        // Self
        let myNet = 0;
        if (myWorking) {
            if (!myOnLeave) {
                // Bracket Creep Fix: Deflate gross, calculate net, then inflate net
                const deflatedGross = myCurrentGross / inflationMult;
                const deflatedNet = calcNetIncome(deflatedGross, currentMyAge, myDependents);
                myNet = deflatedNet * inflationMult;
            } else {
                const workMonths = 12 - myLeaveMonthsThisYear;
                const salaryPart = (myCurrentGross * (workMonths / 12));

                const deflatedSalaryPart = salaryPart / inflationMult;
                const deflatedNetPart = calcNetIncome(deflatedSalaryPart, currentMyAge, myDependents);
                myNet += deflatedNetPart * inflationMult;

                // Allowance is usually based on past real salary, but for simplicity we keep it as is or deflate
                const allowance = calcParentalLeaveAllowance(myCurrentGross, 0, myLeaveMonthsThisYear);
                myNet += allowance;
                // Leave allowance is strictly not "salary" but for simplicity grouped here or OTHER?
                // Letting it range as Salary.
            }
        }
        yearIncome += myNet;
        breakdown.income.salaryMy += myNet;

        // Partner
        let partnerNet = 0;
        if (partnerWorking) {
            if (!partnerOnLeave) {
                const deflatedGross = partnerCurrentGross / inflationMult;
                const deflatedNet = calcNetIncome(deflatedGross, currentPartnerAge, partnerDependents);
                partnerNet = deflatedNet * inflationMult;
            } else {
                const workMonths = 12 - partnerLeaveMonthsThisYear;
                const salaryPart = (partnerCurrentGross * (workMonths / 12));

                const deflatedSalaryPart = salaryPart / inflationMult;
                const deflatedNetPart = calcNetIncome(deflatedSalaryPart, currentPartnerAge, partnerDependents);
                partnerNet += deflatedNetPart * inflationMult;

                const allowance = calcParentalLeaveAllowance(partnerCurrentGross, 0, partnerLeaveMonthsThisYear);
                partnerNet += allowance;
            }
        }
        yearIncome += partnerNet;
        breakdown.income.salaryPartner += partnerNet;

        // Retirement Bonus
        if (currentMyAge === myRetAge) {
            const netBonusMy = calcRetirementNet(myRetBonus, Math.max(1, myRetAge - 22));
            yearIncome += netBonusMy;
            breakdown.income.other += netBonusMy;
            events.push({ type: 'retirement', label: '退職金(夫)' });
        }
        if (currentPartnerAge === partnerRetAge) {
            const netBonusPartner = calcRetirementNet(partnerRetBonus, Math.max(1, partnerRetAge - 22));
            yearIncome += netBonusPartner;
            breakdown.income.other += netBonusPartner;
            events.push({ type: 'retirement', label: '退職金(妻)' });
        }

        // Pension
        // 実際の年金増加率は、インフレ率からマクロ経済スライド分を引いたもの
        const pensionRealGrowthRate = Math.max(0, inflationRate - pensionMacroSlide);
        // Base is at age 65 (or retirement). Until age 65, the base pension grows with wage growth (effectiveSalaryGrowthRate).
        // For simplicity, we assume wage growth up to age 65, then inflation-macro slide after 65.
        // y is years from now. 
        // Growth up to age 65 for the base amount:
        const myYearsTo65 = Math.max(0, 65 - myAge);
        const partnerYearsTo65 = Math.max(0, 65 - partnerAge);

        const myPensionBase = myPension * Math.pow(1 + effectiveSalaryGrowthRate, myYearsTo65);
        const partnerPensionBase = partnerPension * Math.pow(1 + effectiveSalaryGrowthRate, partnerYearsTo65);

        // Growth after 65:
        const myYearsOver65 = Math.max(0, currentMyAge - 65);
        const partnerYearsOver65 = Math.max(0, currentPartnerAge - 65);

        if (currentMyAge >= 65) {
            const pMy = myPensionBase * Math.pow(1 + pensionRealGrowthRate, myYearsOver65);
            yearIncome += pMy;
            breakdown.income.pensionMy += pMy;
        }
        if (currentPartnerAge >= 65) {
            const pPartner = partnerPensionBase * Math.pow(1 + pensionRealGrowthRate, partnerYearsOver65);
            yearIncome += pPartner;
            breakdown.income.pensionPartner += pPartner;
        }

        // Corporate Pension / Retirement Benefit
        if (myCorporatePension > 0 && currentMyAge >= myCorpStart && currentMyAge < (myCorpStart + myCorpDuration)) {
            yearIncome += myCorporatePension;
            breakdown.income.pensionMy += myCorporatePension;
        }
        if (partnerCorporatePension > 0 && currentPartnerAge >= partnerCorpStart && currentPartnerAge < (partnerCorpStart + partnerCorpDuration)) {
            yearIncome += partnerCorporatePension;
            breakdown.income.pensionPartner += partnerCorporatePension;
        }

        // Expenses
        const numChildren = children.filter(c => (y - c.birthYear) >= 0 && (y - c.birthYear) < 22).length;
        const familyMultiplier = 1 + numChildren * 0.25;
        const bothRetired = currentMyAge >= Math.min(myRetAge, myQuitAge) && currentPartnerAge >= Math.min(partnerRetAge, partnerQuitAge);
        const livingMultiplier = bothRetired ? 0.85 : 1.0;

        // Living costs: rent + other (rent removed after housing purchase, until sold if no new rent specified)
        const isAfterHousingPurchase = hasHousing && y >= housingYearOffset && !isHouseSold;
        const effectiveRent = isAfterHousingPurchase ? 0 : monthlyRent;
        const rentInflMult = Math.pow(1 + rentInflationRate, y);
        let yearLiving = (effectiveRent * 12 * rentInflMult + monthlyOther * 12 * inflationMult) * familyMultiplier * livingMultiplier;
        yearExpense += yearLiving;
        breakdown.expense.living += yearLiving;

        // Special Annual Expenses (inflation adjusted)
        const specialEx = annualSpecialBase * inflationMult;
        yearExpense += specialEx;
        breakdown.expense.other += specialEx;

        // Kids
        // 児童手当の多子加算カウント用：22歳以下の子供リストを年齢順（年長順）にソート
        const childrenUnder23 = children
            .map((c, idx) => ({ idx, age: y - c.birthYear }))
            .filter(c => c.age >= 0 && c.age <= 22)
            .sort((a, b) => b.age - a.age); // 年上の子が最初
        const rankMap = {};
        childrenUnder23.forEach((c, rank) => {
            rankMap[c.idx] = rank + 1; // 1-indexed (1:長子, 2:第2子, 3:第3子...)
        });

        children.forEach((child, i) => {
            const childAge = y - child.birthYear;
            if (childAge === 0 && !child.isExisting) {
                yearIncome += 50; // Childbirth allowance
                breakdown.income.other += 50;
                events.push({ type: 'birth', label: `第${i + 1}子誕生` });
            }
            if (childAge >= 0) {
                // Allowance
                const rank = rankMap[i] || 0; // 22歳以下でなければ0
                const allowance = calcChildAllowance(childAge, rank);
                yearIncome += allowance;
                breakdown.income.other += allowance;

                // Education (Detailed)
                const eduCost = calcEducationCostDetailed(childAge, child.edu, child.juku);
                const eduCostInf = eduCost * inflationMult;
                yearExpense += eduCostInf;
                breakdown.expense.education += eduCostInf;
            }
            // Wedding at age 30
            if (hasWedding && childAge === 30) {
                const wCost = weddingGiftAmt * inflationMult;
                yearExpense += wCost;
                breakdown.expense.event += wCost;
                events.push({ type: 'wedding', label: `第${i + 1}子結婚` });
            }
            // Grandchild born at age 31
            if (hasWedding && childAge === 31) {
                const gCost = grandchildBirthGiftAmt * inflationMult;
                yearExpense += gCost;
                breakdown.expense.event += gCost;
                events.push({ type: 'grandchild', label: `孫誕生(第${i + 1}子)` });
            }
            // Grandchild support: child age 31-43 (grandchild 0-12)
            if (hasWedding && childAge >= 31 && childAge <= 43) {
                const gsCost = grandchildSupportAmt * inflationMult;
                yearExpense += gsCost;
                breakdown.expense.event += gsCost;
            }
        });

        // --- Custom Events (Feature 3) ---
        const customEvents = getCustomEvents();
        customEvents.forEach(evt => {
            // One-time
            if (evt.type === 'expense_once' && currentMyAge === evt.age) {
                const amountInf = evt.amount * inflationMult;
                yearExpense += amountInf;
                breakdown.expense.event += amountInf;
                events.push({ type: 'medical', label: evt.name }); // Use generic or existing style
            }
            if (evt.type === 'income_once' && currentMyAge === evt.age) {
                const amountInf = evt.amount * inflationMult;
                yearIncome += amountInf;
                breakdown.income.other += amountInf;
                events.push({ type: 'money', label: evt.name });
            }
            // Annual (From age)
            if (currentMyAge >= evt.age) {
                if (evt.type === 'expense_annual') {
                    yearExpense += evt.amount * inflationMult;
                    breakdown.expense.other += evt.amount * inflationMult;
                }
                if (evt.type === 'expense_reduce') {
                    yearExpense -= evt.amount * inflationMult;
                    breakdown.expense.other -= evt.amount * inflationMult; // reduce cost
                }
                if (evt.type === 'income_annual') {
                    yearIncome += evt.amount * inflationMult; // Assume base amount adds to income
                    breakdown.income.other += evt.amount * inflationMult;
                }
            }
            // Add marker for annual start
            if (currentMyAge === evt.age && (evt.type.includes('annual') || evt.type.includes('reduce'))) {
                events.push({ type: 'life', label: `${evt.name}開始` });
            }
        });

        // Housing
        let currentHousingValue = 0;
        let remainingLoanBalance = 0;

        if (hasHousing && y >= housingYearOffset) {
            const yearsSincePurchase = y - housingYearOffset;

            // House sale logic
            if (!isHouseSold && currentMyAge === housingSellAge && yearsSincePurchase > 0) {
                isHouseSold = true;

                // Calculate sale price
                let salePrice = 0;
                if (housingSellType === 'auto') {
                    // inflation and depreciation on original price
                    salePrice = housingPrice * Math.pow(1 + inflationRate, yearsSincePurchase) * Math.pow(1 - housingDepreciation, yearsSincePurchase);
                } else {
                    salePrice = housingSellManualPrice;
                }

                // Calculate remaining loan balance BEFORE sale (to pay it off)
                const r = loanRate / 100 / 12; // simplified using initial rate or could use currentLoanRate if tracked precisely
                const n = loanYears * 12;
                const i = yearsSincePurchase * 12; // months passed at start of this year
                let balanceBeforeSale = 0;
                if (yearsSincePurchase < loanYears) {
                    if (r === 0) {
                        balanceBeforeSale = Math.max(0, mortgagePrincipal * 10000 - (mortgagePrincipal * 10000 / n) * i);
                    } else {
                        balanceBeforeSale = mortgagePrincipal * 10000 * (Math.pow(1 + r, n) - Math.pow(1 + r, i)) / (Math.pow(1 + r, n) - 1);
                    }
                }
                const balanceManBeforeSale = balanceBeforeSale / 10000;

                // Add sale revenue to income
                yearIncome += salePrice;
                breakdown.income.other += salePrice;

                // Add loan payoff to expense
                if (balanceManBeforeSale > 0) {
                    yearExpense += balanceManBeforeSale;
                    breakdown.expense.housing += balanceManBeforeSale;
                }

                events.push({ type: 'housing', label: `持ち家売却(${Math.round(salePrice)}万円)` });
                if (balanceManBeforeSale > 0) {
                    events.push({ type: 'housing', label: `ローン一括返済(${Math.round(balanceManBeforeSale)}万円)` });
                }
            }

            if (!isHouseSold) {
                if (yearsSincePurchase === 0) {
                    // Housing Inflation Fix: Apply inflation from current year up to purchase year
                    const housingInflMult = Math.pow(1 + inflationRate, housingYearOffset);
                    housingPrice = housingPrice * housingInflMult;
                    housingDown = housingDown * housingInflMult;
                    housingFee = housingFee * housingInflMult;

                    // Re-calculate mortgage principle
                    const newMortgagePrincipal = housingPrice - housingDown;
                    // Apply the new mortgage principle for future years
                    mortgagePrincipal = newMortgagePrincipal;

                    yearExpense += housingDown + housingFee;
                    breakdown.expense.housing += housingDown + housingFee;
                    events.push({ type: 'housing', label: '住宅購入' });
                }

                // Maintenance Cost (Periodic)
                if (yearsSincePurchase > 0 && housingMaintenanceFreq > 0 && yearsSincePurchase % housingMaintenanceFreq === 0) {
                    const maintCostInf = housingMaintenanceCost * inflationMult;
                    yearExpense += maintCostInf;
                    breakdown.expense.housing += maintCostInf;
                    events.push({ type: 'housing', label: '住宅修繕費' });
                }

                // Variable Interest Rate update
                let currentLoanRate = loanRate;
                let appliedReviewYear = 0;

                // Apply the highest review rate whose year <= yearsSincePurchase
                mortgageReviews.forEach(review => {
                    if (yearsSincePurchase >= review.year && review.year > appliedReviewYear) {
                        currentLoanRate = review.rate;
                        appliedReviewYear = review.year;
                    }
                });

                const currentAnnualMortgage = calcAnnualMortgage(mortgagePrincipal, loanYears, currentLoanRate);

                // House value depreciation
                currentHousingValue = Math.max(0, housingPrice * Math.pow(1 - housingDepreciation, yearsSincePurchase));

                if (yearsSincePurchase < loanYears) {
                    yearExpense += currentAnnualMortgage;
                    breakdown.expense.housing += currentAnnualMortgage;

                    // Mortgage Tax Deduction & Balance Calculation
                    const r = currentLoanRate / 100 / 12;
                    const n = loanYears * 12;
                    const i = yearsSincePurchase * 12 + 12; // months passed at end of this year
                    let balance = 0;
                    if (r === 0) {
                        balance = Math.max(0, mortgagePrincipal * 10000 - (mortgagePrincipal * 10000 / n) * i);
                    } else {
                        balance = mortgagePrincipal * 10000 * (Math.pow(1 + r, n) - Math.pow(1 + r, i)) / (Math.pow(1 + r, n) - 1);
                    }
                    const balanceMan = balance / 10000;
                    remainingLoanBalance = balanceMan;

                    const taxDeduction = calcMortgageTaxDeduction(balanceMan, yearsSincePurchase + 1, false);
                    yearIncome += taxDeduction;
                    breakdown.income.other += taxDeduction;

                    // Log an event if an interest rate change actually happened this year
                    mortgageReviews.forEach(review => {
                        if (yearsSincePurchase === review.year) {
                            events.push({ type: 'housing', label: `金利見直し(${review.rate}%)` });
                        }
                    });
                }

                // Running Costs (Mgmt + Tax)
                // 管理費等はインフレ影響を受けるが、税金は評価額に伴うためインフレから除外
                const annualMgmt = housingMgmtFee * 12 / 10000;
                const annualTax = housingTax / 10000;
                const houseRun = (annualMgmt * inflationMult) + annualTax;
                yearExpense += houseRun;
                breakdown.expense.housing += houseRun;
            }
        }

        // Car
        if (hasCar && currentMyAge <= carEndAge) {
            const maint = carMaintenance * inflationMult;
            yearExpense += maint;
            breakdown.expense.car += maint;

            // First purchase timing considers current car age
            const firstPurchaseYear = Math.max(1, carCycle - carCurrentAge);
            const isCarPurchaseYear = ((y === firstPurchaseYear) ||
                (y > firstPurchaseYear && (y - firstPurchaseYear) % carCycle === 0)) && (currentMyAge < carEndAge);
            if (isCarPurchaseYear) {
                // Check if all children are independent (age >= 22)
                const allChildrenIndependent = children.length === 0 ||
                    children.every(c => (y - c.birthYear) >= 22);
                const useCompact = carDownsize && allChildrenIndependent && children.length > 0;
                const price = useCompact ? carCompactPrice : carPrice;
                const carCost = price * inflationMult;
                yearExpense += carCost;
                breakdown.expense.car += carCost;
                events.push({ type: 'car', label: useCompact ? '小型車購入' : '車購入' });
            }
        } else if (hasCar && currentMyAge === carEndAge + 1) {
            events.push({ type: 'life', label: '車を手放す' });
        }

        // Insurance
        if (currentMyAge < insuranceEndAge) {
            const insCost = lifeInsurance * 12;
            yearExpense += insCost;
            breakdown.expense.insurance += insCost;
        }

        // Elderly Care (Refined: Medical + Nursing Cap)
        let careCost = 0;
        const medicalAnnual = elderlyMedicalMonthly * 12;
        const nursingCapAnnual = nursingMonthlyCap * 12;

        // Medical (Base)
        if (currentMyAge >= 65) careCost += medicalAnnual * inflationMult;
        if (currentPartnerAge >= 65) careCost += medicalAnnual * inflationMult;

        // Nursing (Cap)
        if (currentMyAge >= nursingStartAge) careCost += nursingCapAnnual * inflationMult;
        if (currentPartnerAge >= nursingStartAge) careCost += nursingCapAnnual * inflationMult;

        // Parent Care
        if (hasParentCare) {
            if (currentMyAge === parentCareStartAge) {
                careCost += parentCareInitial * inflationMult;
                events.push({ type: 'care', label: '親の介護(初期費用)' });
            }
            if (currentMyAge >= parentCareStartAge && currentMyAge < parentCareStartAge + parentCareDuration) {
                careCost += parentCareMonthly * 12 * inflationMult;
            }
        }

        yearExpense += careCost;
        breakdown.expense.care += careCost;

        // Savings & Investments (NISA/iDeCo) interaction...
        const hasNisa = $('nisaToggle').checked;
        // NISA Params
        const nisaMonthlyMy = hasNisa ? val('nisaMonthlyMy') : 0;
        const nisaReturnMy = hasNisa ? (val('nisaReturnMy') / 100) : 0;
        const nisaMonthlyPartner = hasNisa ? val('nisaMonthlyPartner') : 0;
        const nisaReturnPartner = hasNisa ? (val('nisaReturnPartner') / 100) : 0;
        const nisaVariance = hasNisa ? (val('nisaVariance') / 100) : 0; // Shared
        const nisaEndAgeMy = hasNisa ? val('nisaEndAgeMy') : 999;
        const nisaEndAgePartner = hasNisa ? val('nisaEndAgePartner') : 999;

        const hasIdeco = $('idecoToggle').checked;
        // iDeCo Params
        const idecoMonthlyMy = hasIdeco ? val('idecoMonthlyMy') : 0;
        const idecoReturnMy = hasIdeco ? (val('idecoReturnMy') / 100) : 0;
        const idecoReceiveMy = val('idecoReceiveMy');

        const idecoPartnerActive = $('idecoPartnerActive').checked;
        const idecoMonthlyPartner = (hasIdeco && idecoPartnerActive) ? val('idecoMonthlyPartner') : 0;
        const idecoReturnPartner = (hasIdeco && idecoPartnerActive) ? (val('idecoReturnPartner') / 100) : 0;
        const idecoReceivePartner = (hasIdeco && idecoPartnerActive) ? val('idecoReceivePartner') : 'lump';

        // iDeCo Interaction (Me)
        if (hasIdeco && !idecoReceivedMy) {
            if (currentMyAge < 60) {
                const contribution = idecoMonthlyMy * 12;
                yearExpense += contribution;
                breakdown.expense.investment += contribution;
                idecoPrincipalMy += contribution;

                const approxTaxRate = myCurrentGross > 700 ? 0.3 : myCurrentGross > 400 ? 0.2 : 0.15;
                const taxBenefit = contribution * approxTaxRate;
                yearIncome += taxBenefit;
                breakdown.income.other += taxBenefit;

                idecoBalanceMy = (idecoBalanceMy + contribution) * (1 + idecoReturnMy);
            } else {
                idecoBalanceMy *= (1 + idecoReturnMy); // Growth only
            }

            // Receive Logic (Me)
            if (idecoReceiveMy === 'lump' && currentMyAge === 60) {
                yearIncome += idecoBalanceMy;
                breakdown.income.assetReturn += idecoBalanceMy;
                events.push({ type: 'ideco', label: 'iDeCo一括(夫)' });
                idecoBalanceMy = 0; idecoPrincipalMy = 0;
                idecoReceivedMy = true;
            } else if (idecoReceiveMy === 'split' && currentMyAge >= 60 && currentMyAge < 75) {
                const remainingYears = 75 - currentMyAge;
                if (remainingYears > 0 && idecoBalanceMy > 0) {
                    const payout = idecoBalanceMy / remainingYears;
                    yearIncome += payout;
                    breakdown.income.assetReturn += payout;
                    const ratio = payout / idecoBalanceMy;
                    idecoPrincipalMy -= idecoPrincipalMy * ratio;
                    idecoBalanceMy -= payout;
                    if (currentMyAge === 60) events.push({ type: 'ideco', label: 'iDeCo年金開始(夫)' });
                    if (currentMyAge === 74) idecoReceivedMy = true;
                }
            }
        }

        // iDeCo Interaction (Partner)
        if (hasIdeco && !idecoReceivedPartner) {
            if (currentPartnerAge < 60) {
                const contribution = idecoMonthlyPartner * 12;
                yearExpense += contribution;
                breakdown.expense.investment += contribution;
                idecoPrincipalPartner += contribution;

                // Assumed tax rate for partner (simplified, assuming less than main earner usually, or same)
                const approxTaxRate = partnerCurrentGross > 700 ? 0.3 : partnerCurrentGross > 400 ? 0.2 : 0.15;
                const taxBenefit = contribution * approxTaxRate;
                yearIncome += taxBenefit;
                breakdown.income.other += taxBenefit;

                idecoBalancePartner = (idecoBalancePartner + contribution) * (1 + idecoReturnPartner);
            } else {
                idecoBalancePartner *= (1 + idecoReturnPartner);
            }

            // Receive Logic (Partner)
            if (idecoReceivePartner === 'lump' && currentPartnerAge === 60) {
                yearIncome += idecoBalancePartner;
                breakdown.income.assetReturn += idecoBalancePartner;
                events.push({ type: 'ideco', label: 'iDeCo一括(妻)' });
                idecoBalancePartner = 0; idecoPrincipalPartner = 0;
                idecoReceivedPartner = true;
            } else if (idecoReceivePartner === 'split' && currentPartnerAge >= 60 && currentPartnerAge < 75) {
                const remainingYears = 75 - currentPartnerAge;
                if (remainingYears > 0 && idecoBalancePartner > 0) {
                    const payout = idecoBalancePartner / remainingYears;
                    yearIncome += payout;
                    breakdown.income.assetReturn += payout;
                    const ratio = payout / idecoBalancePartner;
                    idecoPrincipalPartner -= idecoPrincipalPartner * ratio;
                    idecoBalancePartner -= payout;
                    if (currentPartnerAge === 60) events.push({ type: 'ideco', label: 'iDeCo年金開始(妻)' });
                    if (currentPartnerAge === 74) idecoReceivedPartner = true;
                }
            }
        }

        // Aggregate iDeCo for Chart
        idecoBalance = idecoBalanceMy + idecoBalancePartner;
        const idecoPrincipal = idecoPrincipalMy + idecoPrincipalPartner;
        idecoReceived = idecoReceivedMy && idecoReceivedPartner; // Loose definition, mostly for logic checks

        // NISA Interaction
        if (hasNisa) {
            // (nisaSold check removed)
            // My Contribution (NISA Limits Fix: Remove inflation multiplier from contributions)
            const contMy = (currentMyAge < nisaEndAgeMy) ? nisaMonthlyMy * 12 : 0;
            yearExpense += contMy;
            breakdown.expense.investment += contMy;
            nisaPrincipalMy += contMy;
            nisaBalanceMy = (nisaBalanceMy + contMy) * (1 + nisaReturnMy);

            // Partner Contribution
            const contPartner = (currentPartnerAge < nisaEndAgePartner) ? nisaMonthlyPartner * 12 : 0;
            yearExpense += contPartner;
            breakdown.expense.investment += contPartner;
            nisaPrincipalPartner += contPartner;
            nisaBalancePartner = (nisaBalancePartner + contPartner) * (1 + nisaReturnPartner);

            // Aggregate for checks
            nisaBalance = nisaBalanceMy + nisaBalancePartner;

            // Variance (Tracking on Total Balance for simplicity, or split?)
            // Variance is market effect. 
            // We'll track Opt/Pes on the *Total* for simplicity, as per previous logic.
            // Re-calculating Opt/Pes from scratch is hard with splitting.
            // Let's approximate: 
            // Opt/Pes tracks the *total* portfolio trajectory. 
            // Base growth = (contMy + contPartner) added.
            // Weighted return? No, let's just apply Base Return +/- Variance to the Opt/Pes tracks.
            // Base Return = Average?
            // Actually, let's keep Opt/Pes logic simple: 
            // It tracks `nisaBalance` (total).
            // We add `contMy + contPartner`.
            // We apply `nisaReturnMy` (approx?) No, we need a representative return.
            // Let's use `nisaReturnMy` as the base for Opt/Pes variance for now.
            // Or better: Calculate weighted average return?
            // For simplicity, let's assume Opt/Pes applies to the *aggregated* portfolio using "My" return setting as baseline.
            // (User requested separate settings, but Variance is a global property usually).

            const totalCont = contMy + contPartner;
            nisaBalanceOpt = (nisaBalanceOpt + totalCont) * (1 + nisaReturnMy + nisaVariance);
            nisaBalancePes = (nisaBalancePes + totalCont) * (1 + Math.max(0, nisaReturnMy - nisaVariance));
            // (nisaSold check removed)

            // Check Sells (Shared Logic)
            nisaSellConfigs.forEach((cfg) => {
                if (cfg.length === 0 || cfg.type === 'none') return;

                // One-time sell
                const isOneTime = (y === cfg.yearOffset) && (cfg.type === 'full' || cfg.type === 'partial');
                // Annual sell
                const isAnnual = (y >= cfg.yearOffset) && (cfg.type === 'partial_annual');

                if (isOneTime || isAnnual) {
                    nisaBalance = nisaBalanceMy + nisaBalancePartner; // Latest
                    if (nisaBalance > 0) {
                        let sellAmt = 0;
                        if (cfg.type === 'full') {
                            sellAmt = nisaBalance;
                        } else {
                            sellAmt = Math.min(cfg.amount, nisaBalance);
                        }

                        // Proportional Withdrawal
                        const ratioMy = nisaBalanceMy / nisaBalance;
                        const sellMy = sellAmt * ratioMy;
                        const sellPartner = sellAmt - sellMy;

                        nisaBalanceMy -= sellMy;
                        // Reduce principal proportionally? 
                        // For partial annual, this reduces principal over time.
                        if (nisaBalanceMy > 0) {
                            nisaPrincipalMy -= nisaPrincipalMy * (sellMy / (nisaBalanceMy + sellMy));
                        } else {
                            nisaPrincipalMy = 0;
                        }

                        nisaBalancePartner -= sellPartner;
                        if (nisaBalancePartner > 0) {
                            nisaPrincipalPartner -= nisaPrincipalPartner * (sellPartner / (nisaBalancePartner + sellPartner));
                        } else {
                            nisaPrincipalPartner = 0;
                        }

                        yearIncome += sellAmt;
                        breakdown.income.assetReturn += sellAmt;

                        let label = '';
                        if (cfg.type === 'full') label = 'NISA全額解約';
                        else if (cfg.type === 'partial') label = `NISA一部解約(${Math.round(sellAmt)}万)`;
                        else label = `NISA取崩(${Math.round(sellAmt)}万)`;

                        // Add event only for one-time or first year of annual
                        if (isOneTime || (isAnnual && y === cfg.yearOffset)) {
                            events.push({ type: 'nisa', label: label + (isAnnual ? '開始' : '') });
                        }

                        nisaBalance = nisaBalanceMy + nisaBalancePartner;
                        if (nisaBalance <= 1) {
                            nisaBalance = 0; nisaPrincipalMy = 0; nisaPrincipalPartner = 0;
                        }

                        // Variance Sells
                        if (nisaBalanceOpt > 0) {
                            const sellOpt = Math.min(sellAmt, nisaBalanceOpt);
                            nisaBalanceOpt -= sellOpt;
                            if (nisaBalanceOpt <= 1) nisaBalanceOpt = 0;
                        }
                        if (nisaBalancePes > 0) {
                            const sellPes = Math.min(sellAmt, nisaBalancePes);
                            nisaBalancePes -= sellPes;
                            if (nisaBalancePes <= 1) nisaBalancePes = 0;
                        }
                    }
                }
            });
        }

        const nisaPrincipal = nisaPrincipalMy + nisaPrincipalPartner;

        const annualCashFlow = yearIncome - yearExpense;
        cumulativeAsset += annualCashFlow;

        // --- Automatic NISA Withdrawal on Cash Shortfall ---
        let nisaAutoSellAmount = 0;
        const isAutoNisaEnabled = $('autoNisaWithdrawal') ? $('autoNisaWithdrawal').checked : false;

        if (isAutoNisaEnabled && cumulativeAsset < emergencyFund) {
            const deficit = emergencyFund - cumulativeAsset;
            const totalNisa = nisaBalanceMy + nisaBalancePartner;

            if (totalNisa > 0) {
                const sellAmount = Math.min(deficit, totalNisa);
                nisaAutoSellAmount = sellAmount;

                // Proportional Sell
                const ratioMy = (totalNisa > 0) ? (nisaBalanceMy / totalNisa) : 0;
                const sellMy = sellAmount * ratioMy;
                const sellPartner = sellAmount - sellMy;

                nisaBalanceMy -= sellMy;
                if (nisaBalanceMy > 0) {
                    const redRatio = sellMy / (nisaBalanceMy + sellMy);
                    nisaPrincipalMy -= nisaPrincipalMy * redRatio;
                } else {
                    nisaPrincipalMy = 0;
                }

                nisaBalancePartner -= sellPartner;
                if (nisaBalancePartner > 0) {
                    const redRatio = sellPartner / (nisaBalancePartner + sellPartner);
                    nisaPrincipalPartner -= nisaPrincipalPartner * redRatio;
                } else {
                    nisaPrincipalPartner = 0;
                }

                // Transfer NISA to Cash
                cumulativeAsset += sellAmount;

                // Update NISA aggregate
                nisaBalance = nisaBalanceMy + nisaBalancePartner;
                if (nisaBalance <= 1) {
                    nisaBalance = 0; nisaPrincipalMy = 0; nisaPrincipalPartner = 0;
                }

                // Variance tracking
                if (nisaBalanceOpt > 0) {
                    nisaBalanceOpt = Math.max(0, nisaBalanceOpt - sellAmount);
                }
                if (nisaBalancePes > 0) {
                    nisaBalancePes = Math.max(0, nisaBalancePes - sellAmount);
                }

                events.push({ type: 'nisa', label: `NISA自動取崩(${Math.round(sellAmount)}万)` });
            }
        }

        const netRealEstate = Math.max(0, currentHousingValue - remainingLoanBalance);
        const totalWealth = cumulativeAsset + nisaBalance + (idecoReceived ? 0 : idecoBalance) + netRealEstate;
        const totalWealthOpt = cumulativeAsset + nisaBalanceOpt + (idecoReceived ? 0 : idecoBalance) + netRealEstate;
        const totalWealthPes = cumulativeAsset + nisaBalancePes + (idecoReceived ? 0 : idecoBalance) + netRealEstate;

        // Collect Ages
        const childAges = children.map(c => {
            const age = y - c.birthYear;
            return age >= 0 ? age : null;
        });
        // Grandchildren (Assumed born at Child Age 31)
        const grandchildAges = children.map(c => {
            const cAge = y - c.birthYear;
            if (cAge >= 31) {
                return cAge - 31;
            }
            return null;
        });

        // Add to Lifetime Expenses
        lifetimeExpenses.housing += breakdown.expense.housing;
        lifetimeExpenses.education += breakdown.expense.education;
        lifetimeExpenses.living += breakdown.expense.living;
        lifetimeExpenses.car += breakdown.expense.car;
        lifetimeExpenses.insurance += breakdown.expense.insurance;
        lifetimeExpenses.care += breakdown.expense.care;
        lifetimeExpenses.taxes += breakdown.expense.taxes;
        lifetimeExpenses.investment += breakdown.expense.investment;
        lifetimeExpenses.other += breakdown.expense.event + breakdown.expense.other;

        data.push({
            year: calendarYear,
            myAge: currentMyAge,
            partnerAge: currentPartnerAge,
            childAges: childAges,      // [Age, Age, null]
            grandchildAges: grandchildAges, // [Age, null, null]
            income: Math.round(yearIncome),
            expense: Math.round(yearExpense),
            cashflow: Math.round(annualCashFlow),
            cashAsset: Math.round(cumulativeAsset),
            asset: Math.round(totalWealth),
            assetOptimistic: Math.round(totalWealthOpt),
            assetPessimistic: Math.round(totalWealthPes),
            nisaBalance: Math.round(nisaBalance),
            nisaProfit: Math.round(nisaBalance - nisaPrincipal),
            idecoBalance: Math.round(idecoBalance),
            idecoProfit: Math.round(idecoBalance - idecoPrincipal),
            nisaAutoSell: Math.round(nisaAutoSellAmount),
            events: events,
            breakdown: breakdown
        });
    }

    window.lifetimeExpenses = lifetimeExpenses;
    window.lastSimulationData = data;
    return data;
}

// =============================================
// SCENARIO MANAGEMENT
// =============================================

function saveScenario() {
    if (savedScenarios.length >= 5) {
        alert('シナリオは最大5つまで保存できます');
        return;
    }
    const data = runSimulation();
    const name = prompt('シナリオ名を入力してください', `シナリオ${savedScenarios.length + 1}`);
    if (!name) return;
    const color = SCENARIO_COLORS[savedScenarios.length % SCENARIO_COLORS.length];
    savedScenarios.push({ name, data, color });
    alert(`「${name}」を保存しました。シミュレーション実行時にチャートで比較できます。`);
}

function removeScenario(index) {
    savedScenarios.splice(index, 1);
    // Re-run display if results are visible
    if (!$('resultsSection').classList.contains('hidden')) {
        const data = runSimulation();
        renderResults(data);
    }
}

function clearScenarios() {
    savedScenarios = [];
    if (!$('resultsSection').classList.contains('hidden')) {
        const data = runSimulation();
        renderResults(data);
    }
}

// =============================================
// RENDERING
// =============================================

function renderResults(data, skipScroll = false) {
    // $('inputSection').classList.add('hidden'); // Keep inputs visible for adjustments
    $('resultsSection').classList.remove('hidden');

    // Summary stats
    let peakAsset = -Infinity, minAsset = Infinity;
    let minCashAsset = Infinity;
    for (let i = 0; i < data.length; i++) {
        if (data[i].asset > peakAsset) peakAsset = data[i].asset;
        if (data[i].asset < minAsset) minAsset = data[i].asset;
        if (data[i].cashAsset < minCashAsset) minCashAsset = data[i].cashAsset;
    }
    const finalAsset = data[data.length - 1].asset;
    const finalCashAsset = data[data.length - 1].cashAsset;
    const negativeYear = data.find(d => d.cashAsset < 0);

    $('summaryStats').innerHTML = `
    <div class="stat-item">
      <div class="stat-label">最大資産額</div>
      <div class="stat-value positive">${peakAsset.toLocaleString()}</div>
      <div class="stat-unit">万円 <span style="font-size:0.8em; color:var(--text-secondary)">(${data.find(d => d.asset === peakAsset)?.myAge}歳)</span></div>
    </div>
    <div class="stat-item">
      <div class="stat-label">最小キャッシュ残高</div>
      <div class="stat-value ${minCashAsset < 0 ? 'negative' : ''}">${minCashAsset.toLocaleString()}</div>
      <div class="stat-unit">万円 <span style="font-size:0.8em; color:var(--text-secondary)">(${data.find(d => d.cashAsset === minCashAsset)?.myAge}歳)</span></div>
    </div>
    <div class="stat-item">
      <div class="stat-label">100歳時点の資産</div>
      <div class="stat-value ${finalAsset >= 0 ? 'positive' : 'negative'}">${finalAsset.toLocaleString()}</div>
      <div class="stat-unit">万円 <span style="font-size:0.7em; color:var(--text-secondary)">(キャッシュ: ${finalCashAsset.toLocaleString()})</span></div>
    </div>
    <div class="stat-item">
      <div class="stat-label">資金ショート</div>
      <div class="stat-value ${negativeYear ? 'negative' : 'positive'}">${negativeYear ? negativeYear.myAge + '歳' : 'なし ✓'}</div>
      <div class="stat-unit">${negativeYear ? '(' + negativeYear.year + '年)' : ''}</div>
    </div>
  `;

    // Table
    const table = $('resultsTable');
    const thead = table.querySelector('thead');
    const tbody = $('resultsBody');

    // 1. Setup Header Dynamic Columns
    // Check how many children from first data row
    const numChildren = (data.length > 0 && data[0].childAges) ? data[0].childAges.length : 0;

    // Rebuild Header
    let headerHTML = `
        <tr>
            <th>年度</th>
            <th>あなた<br>年齢</th>
            <th>パートナー<br>年齢</th>`;

    for (let c = 0; c < numChildren; c++) {
        headerHTML += `<th>第${c + 1}子<br>年齢</th>`;
    }
    // Grandchildren columns? Request says "Grandchild ages".
    // If we assume 1 GC per Child logic as per "Grandchild born at 31", we can show them.
    // However, if they are null most of the time, it might be sparse.
    // Let's add them if they exist in data.
    // Since data structure has `grandchildAges` matching children count.
    for (let c = 0; c < numChildren; c++) {
        headerHTML += `<th>孫(第${c + 1}子)<br>年齢</th>`;
    }

    headerHTML += `
            <th>世帯収入<br>（手取り・万円）</th>
            <th>支出合計<br>（万円）</th>
            <th>年間貯蓄<br>（万円）</th>
            <th>キャッシュ<br>（万円）</th>
            <th>累積資産<br>（万円）</th>
            <th>NISA残高<br><span class="profit-label">(含み益)</span></th>
            <th>iDeCo残高<br><span class="profit-label">(含み益)</span></th>
            <th>ライフイベント</th>
        </tr>
    `;
    thead.innerHTML = headerHTML;

    // Body
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const tr = document.createElement('tr');
        if (row.events.length > 0) tr.classList.add('highlight-event');
        const eventsHtml = row.events.map(e =>
            `<span class="event-badge ${e.type}">${e.label}</span>`
        ).join('');

        let childCells = '';
        if (row.childAges) {
            row.childAges.forEach(age => {
                childCells += `<td>${age !== null ? age + '歳' : '-'}</td>`;
            });
        }
        let gcCells = '';
        if (row.grandchildAges) {
            row.grandchildAges.forEach(age => {
                gcCells += `<td>${age !== null && age >= 0 ? age + '歳' : '-'}</td>`;
            });
        }

        const autoSellMark = row.nisaAutoSell > 0 ? `<span style="color:#f59e0b; font-size:0.7em;"> ↑${row.nisaAutoSell.toLocaleString()}</span>` : '';

        tr.innerHTML = `
      <td>${row.year}</td>
      <td>${row.myAge}歳</td>
      <td>${row.partnerAge}歳</td>
      ${childCells}
      ${gcCells}
      <td><span class="clickable-amount" onclick="showBreakdown(${i}, 'income')">${row.income.toLocaleString()}</span></td>
      <td><span class="clickable-amount" onclick="showBreakdown(${i}, 'expense')">${row.expense.toLocaleString()}</span></td>
      <td class="${row.cashflow >= 0 ? 'positive' : 'negative'}">${row.cashflow >= 0 ? '+' : ''}${row.cashflow.toLocaleString()}</td>
      <td class="${row.cashAsset >= 0 ? '' : 'negative'}">${row.cashAsset.toLocaleString()}${autoSellMark}</td>
      <td class="${row.asset >= 0 ? '' : 'negative'}">${row.asset.toLocaleString()}</td>
      <td class="nisa-cell">${row.nisaBalance.toLocaleString()}<span class="profit-val ${row.nisaProfit >= 0 ? 'positive' : 'negative'}">(${row.nisaProfit >= 0 ? '+' : ''}${row.nisaProfit.toLocaleString()})</span></td>
      <td class="ideco-cell">${row.idecoBalance.toLocaleString()}<span class="profit-val ${row.idecoProfit >= 0 ? 'positive' : 'negative'}">(${row.idecoProfit >= 0 ? '+' : ''}${row.idecoProfit.toLocaleString()})</span></td>
      <td><div class="event-badges">${eventsHtml}</div></td>
    `;
        fragment.appendChild(tr);
    }
    tbody.innerHTML = '';
    tbody.appendChild(fragment);

    // Scenario bar
    renderScenarioBar();

    // Chart
    drawChart(data);

    // Pie Chart
    renderExpensePieChart();

    // Advice
    generateAdvice(data);

    // Timeline (Feature 2)
    renderTimeline(data);

    // Comparison (Feature 4)
    if (savedScenarios.length > 0) {
        $('comparisonCard').classList.remove('hidden');
        renderComparison(data);
    } else {
        $('comparisonCard').classList.add('hidden');
    }

    // Scroll to chart instead of top
    if (!skipScroll) {
        const chartContainer = document.querySelector('.chart-container');
        if (chartContainer) {
            chartContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }
}

// =============================================
// FUND SHORTAGE ADVICE
// =============================================

function generateAdvice(data) {
    const adviceCard = $('adviceCard');
    const adviceContent = $('adviceContent');

    const negativeYear = data.find(d => d.cashAsset < 0);

    if (!negativeYear) {
        // No fund shortage
        adviceCard.style.display = 'block';
        adviceContent.innerHTML = `
            <div class="advice-ok">
                <span>✅</span>
                <span>資金ショートは発生しません。現在のプランは健全です。</span>
            </div>`;
        return;
    }

    // Calculate the deficit amount
    const minCashAsset = Math.min(...data.map(d => d.cashAsset));
    const deficitAmount = Math.abs(minCashAsset);
    const shortageAge = negativeYear.myAge;
    const shortageYear = negativeYear.year;

    // Gather current settings for analysis
    const monthlyRent = val('monthlyRent');
    const monthlyOther = val('monthlyOther');
    const myRetAge = val('myRetirementAge');
    const partnerRetAge = val('partnerRetirementAge');
    const myIncome = val('myIncome');
    const partnerIncome = val('partnerIncome');
    const hasHousing = $('housingToggle').checked;
    const hasCar = $('carToggle').checked;
    const hasNisa = $('nisaToggle').checked;
    const hasIdeco = $('idecoToggle').checked;
    const nisaMonthly = hasNisa ? val('nisaMonthly') : 0;
    const idecoMonthly = hasIdeco ? val('idecoMonthly') : 0;
    const lifeInsurance = val('lifeInsurance');
    const myAge = val('myAge');

    const adviceItems = [];

    // --- Expense Reduction Advice ---
    const expenseAdvice = [];

    // 1. Living cost reduction
    const monthlyTotal = monthlyRent + monthlyOther;
    if (monthlyTotal > 0) {
        const reductionPercent = 10;
        const annualSaving = Math.round(monthlyTotal * 12 * reductionPercent / 100);
        const yearsUntilShortage = shortageAge - myAge;
        const totalSaving = annualSaving * yearsUntilShortage;
        expenseAdvice.push({
            icon: '🏠',
            title: `生活費を${reductionPercent}%削減`,
            desc: `月額${monthlyTotal}万円 → ${Math.round(monthlyTotal * 0.9 * 10) / 10}万円に見直し`,
            impact: totalSaving,
            actionType: 'living_cost_reduce',
            actionValue: reductionPercent
        });
    }

    // 2. Housing advice
    if (hasHousing) {
        const housingPrice = val('housingPrice');
        const reduction = Math.round(housingPrice * 0.1);
        if (housingPrice > 3000) {
            expenseAdvice.push({
                icon: '🏗️',
                title: '住宅価格の見直し',
                desc: `物件価格を${reduction}万円下げる（${housingPrice}万→${housingPrice - reduction}万円）`,
                impact: reduction,
                actionType: 'housing_review',
                actionValue: reduction
            });
        }
    }

    // 3. Car advice
    if (hasCar) {
        const carPrice = val('carPrice');
        const carCycle = val('carCycle') || 7;
        const carMaintenance = val('carMaintenance');
        const yearsUntilShortage = shortageAge - myAge;
        const numPurchases = Math.floor(yearsUntilShortage / carCycle);
        const savingIfCheaper = numPurchases * Math.round(carPrice * 0.3);
        expenseAdvice.push({
            icon: '🚗',
            title: '車の費用を削減',
            desc: `価格帯の見直しや買替サイクルを${carCycle}年→${carCycle + 2}年に延長`,
            impact: savingIfCheaper + carMaintenance * 2,
            actionType: 'car_review',
            actionValue: 2
        });
    }

    // 4. Insurance advice
    if (lifeInsurance > 2) {
        const savingPerYear = Math.round((lifeInsurance - 2) * 12);
        const yearsUntilShortage = shortageAge - myAge;
        expenseAdvice.push({
            icon: '🛡️',
            title: '保険の見直し',
            desc: `月額${lifeInsurance}万円 → 2万円に見直し（不要な特約の解約等）`,
            impact: savingPerYear * Math.min(yearsUntilShortage, 30),
            actionType: 'insurance_review',
            actionValue: 2
        });
    }

    // 5. Education advice
    const childEntries = document.querySelectorAll('.child-entry');
    let hasPrivate = false;
    childEntries.forEach(entry => {
        const selects = entry.querySelectorAll('.edu-select');
        selects.forEach(s => {
            if (s.value === 'private' || s.value === 'private_art' || s.value === 'private_sci') {
                hasPrivate = true;
            }
        });
    });
    if (hasPrivate) {
        expenseAdvice.push({
            icon: '📚',
            title: '教育費の見直し',
            desc: '私立から公立への変更を検討（特に小中学校で効果大）',
            impact: Math.round(childEntries.length * 300),
            actionType: 'education_review',
            actionValue: 'public'
        });
    }

    // --- Income Increase Advice ---
    const incomeAdvice = [];

    // 1. Retirement age extension
    if (myRetAge < 65) {
        const extraYears = 65 - myRetAge;
        const extraIncome = Math.round(calcNetIncome(myIncome) * extraYears);
        incomeAdvice.push({
            icon: '📅',
            title: `定年を${myRetAge}歳→65歳に延長`,
            desc: `${extraYears}年分の給与収入が追加`,
            impact: extraIncome,
            actionType: 'retirement_extend',
            actionValue: 65
        });
    }

    if (partnerRetAge < 65 && partnerIncome > 0) {
        const extraYears = 65 - partnerRetAge;
        const extraIncome = Math.round(calcNetIncome(partnerIncome) * extraYears);
        incomeAdvice.push({
            icon: '📅',
            title: `パートナーの定年を${partnerRetAge}歳→65歳に延長`,
            desc: `${extraYears}年分の給与収入が追加`,
            impact: extraIncome,
            actionType: 'partner_retirement_extend',
            actionValue: 65
        });
    } else if (partnerIncome === 0) {
        // e.g. Partner starts working
        const partIncome = 100;
        const years = Math.max(0, 60 - val('partnerAge'));
        if (years > 0) {
            incomeAdvice.push({
                icon: '💼',
                title: 'パートナーが働く',
                desc: `扶養内で年収100万円稼ぐ（${years}年間）`,
                impact: Math.round(100 * years), // roughly
                actionType: 'partner_work_start',
                actionValue: 100
            });
        }
    }

    // 2. NISA advice
    if (!hasNisa) {
        const monthlyContrib = 3.3;
        const years = Math.max(0, 60 - myAge);
        const annualReturn = 0.05;
        let projected = 0;
        for (let i = 0; i < years; i++) {
            projected = (projected + monthlyContrib * 12) * (1 + annualReturn);
        }
        incomeAdvice.push({
            icon: '📈',
            title: 'NISAの活用を開始',
            desc: `月${monthlyContrib}万円の積立で${years}年後に約${Math.round(projected)}万円（年率5%想定）`,
            impact: Math.round(projected),
            actionType: 'nisa_start',
            actionValue: monthlyContrib
        });
    } else if (nisaMonthly < 30) { // Cap at 30k for advice scope
        const years = Math.max(0, 60 - myAge); // Define years for this block
        // Realistic step-up logic
        // If deficit is huge (>1000k), suggest +5~10k. Otherwise +1~3k.
        let recommendIncrease = 0;
        if (deficitAmount > 1000) {
            recommendIncrease = Math.min(10, 30 - nisaMonthly); // Max +10k if severe
        } else {
            recommendIncrease = Math.min(3, 30 - nisaMonthly);  // Max +3k normally
        }

        // Ensure at least +1k
        recommendIncrease = Math.max(1, recommendIncrease);

        const annualReturn = 0.05;
        let projected = 0;
        for (let i = 0; i < years; i++) {
            projected = (projected + recommendIncrease * 12) * (1 + annualReturn);
        }

        if (projected > 0) {
            const adviceId = `nisa-inc-${Date.now()}`;
            incomeAdvice.push({
                icon: '📈',
                title: `NISA積立を月${nisaMonthly}万→${nisaMonthly + recommendIncrease}万円に増額`,
                desc: `まずは無理のない範囲で増額し、${years}年後に約${Math.round(projected)}万円の上乗せを目指しましょう`,
                impact: Math.round(projected),
                actionType: 'nisa_increase',
                actionValue: recommendIncrease
            });
        }
    }

    // 3. iDeCo advice
    if (!hasIdeco) {
        const monthlyContrib = 2.3;
        const years = Math.max(0, 60 - myAge);
        const annualReturn = 0.04;
        let projected = 0;
        for (let i = 0; i < years; i++) {
            projected = (projected + monthlyContrib * 12) * (1 + annualReturn);
        }
        const taxBenefit = Math.round(monthlyContrib * 12 * 0.2 * years);
        incomeAdvice.push({
            icon: '🏦',
            title: 'iDeCoの活用を開始',
            desc: `月${monthlyContrib}万円で${years}年後に約${Math.round(projected)}万円＋節税効果約${taxBenefit}万円`,
            impact: Math.round(projected) + taxBenefit,
            actionType: 'ideco_start',
            actionValue: monthlyContrib
        });
    }

    // 4. Partner income boost
    if (partnerIncome < 200 && partnerIncome > 0) {
        const boost = 100;
        const years = Math.max(0, partnerRetAge - val('partnerAge'));
        incomeAdvice.push({
            icon: '💼',
            title: 'パートナーの収入アップ',
            desc: `年収を${boost}万円増やす（パートから正社員への転換等）`,
            impact: Math.round(calcNetIncome(partnerIncome + boost) - calcNetIncome(partnerIncome)) * years,
            actionType: 'partner_income_boost',
            actionValue: boost
        });
    }

    // Sort by impact
    expenseAdvice.sort((a, b) => b.impact - a.impact);
    incomeAdvice.sort((a, b) => b.impact - a.impact);

    // Find the single best recommendation across all advice
    const allAdvice = [...expenseAdvice.map(a => ({ ...a, category: 'expense' })), ...incomeAdvice.map(a => ({ ...a, category: 'income' }))];
    allAdvice.sort((a, b) => b.impact - a.impact);
    const topRecommendation = allAdvice.length > 0 ? allAdvice[0] : null;

    // Build HTML
    let html = `
        <div class="advice-summary">
            ⚠️ <strong>${shortageAge}歳（${shortageYear}年）</strong>で資金ショートが発生します。
            最大不足額は <strong>${deficitAmount.toLocaleString()}万円</strong> です。
            以下の改善策を検討してください。
        </div>`;

    // Top Recommendation Section
    if (topRecommendation) {
        let actionBtn = '';
        if (topRecommendation.actionType) {
            actionBtn = `<button class="advice-action-btn" onclick="applyAdvice('${topRecommendation.actionType}', ${topRecommendation.actionValue})">✨ この設定を適用して再計算</button>`;
        }

        html += `<div class="advice-section-title advice-top-title">🏆 イチオシの改善策</div>`;
        html += '<div class="advice-list">';
        html += `
            <div class="advice-item recommended">
                <span class="advice-icon">${topRecommendation.icon}</span>
                <div class="advice-text">
                    <span class="advice-recommended-label">🏆 最もおすすめ</span>
                    <strong>${topRecommendation.title}</strong>
                    <p>${topRecommendation.desc}</p>
                    <span class="advice-impact">効果: 約${topRecommendation.impact.toLocaleString()}万円改善</span>
                    ${actionBtn}
                </div>
            </div>`;
        html += '</div>';
    }

    if (expenseAdvice.length > 0) {
        html += `<div class="advice-section-title">💰 支出を減らす</div>`;
        html += '<div class="advice-list">';
        expenseAdvice.forEach((item, idx) => {
            const isTop = topRecommendation && item.title === topRecommendation.title && topRecommendation.category === 'expense';
            let actionBtn = '';
            if (item.actionType && !isTop) {
                actionBtn = `<button class="advice-action-btn" onclick="applyAdvice('${item.actionType}', ${item.actionValue})">適用して再計算</button>`;
            }

            html += `
                <div class="advice-item${isTop ? ' is-top-duplicate' : ''}">
                    <span class="advice-icon">${item.icon}</span>
                    <div class="advice-text">
                        <strong>${item.title}</strong>
                        <p>${item.desc}</p>
                        <span class="advice-impact">効果: 約${item.impact.toLocaleString()}万円改善</span>
                        ${actionBtn}
                    </div>
                </div>`;
        });
        html += '</div>';
    }

    if (incomeAdvice.length > 0) {
        html += `<div class="advice-section-title">📊 収入を増やす・資産を増やす</div>`;
        html += '<div class="advice-list">';
        incomeAdvice.forEach((item, idx) => {
            const isTop = topRecommendation && item.title === topRecommendation.title && topRecommendation.category === 'income';
            let actionBtn = '';
            if (item.actionType && !isTop) {
                actionBtn = `<button class="advice-action-btn" onclick="applyAdvice('${item.actionType}', ${item.actionValue})">適用して再計算</button>`;
            }

            html += `
                <div class="advice-item${isTop ? ' is-top-duplicate' : ''}">
                    <span class="advice-icon">${item.icon}</span>
                    <div class="advice-text">
                        <strong>${item.title}</strong>
                        <p>${item.desc}</p>
                        <span class="advice-impact">効果: 約${item.impact.toLocaleString()}万円改善</span>
                        ${actionBtn}
                    </div>
                </div>`;
        });
        html += '</div>';
    }

    adviceCard.style.display = 'block';
    adviceContent.innerHTML = html;
}

function renderScenarioBar() {
    const bar = $('scenarioBar');
    const chips = $('scenarioChips');
    if (savedScenarios.length === 0) {
        bar.style.display = 'none';
        return;
    }
    bar.style.display = '';
    chips.innerHTML = '';
    savedScenarios.forEach((s, i) => {
        const chip = document.createElement('div');
        chip.className = 'scenario-chip';
        chip.innerHTML = `
      <span class="dot" style="background:${s.color}"></span>
      <span>${s.name}</span>
      <button class="remove-scenario" onclick="removeScenario(${i})" title="削除">✕</button>
    `;
        chips.appendChild(chip);
    });
}

// =============================================
// CHART DRAWING (Canvas)
// =============================================

function drawChart(data, isPrint = false) {
    const canvas = $('assetChart');
    const container = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();

    // In print mode, use fixed higher resolution/size?
    // Current logic uses screen size.
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;
    const pad = { top: 30, right: 20, bottom: 80, left: 65 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;

    // Define Colors based on Mode
    const colors = {
        text: isPrint ? '#000000' : '#e8e8f0',
        textSecondary: isPrint ? '#333333' : 'rgba(232, 232, 240, 0.6)',
        grid: isPrint ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.06)',
        varianceFill: isPrint ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.10)',
        varianceStroke: isPrint ? 'rgba(99, 102, 241, 0.5)' : 'rgba(99, 102, 241, 0.3)',
        currentFillStats: [
            { pos: 0, color: isPrint ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.2)' },
            { pos: 1, color: isPrint ? 'rgba(99, 102, 241, 0.0)' : 'rgba(99, 102, 241, 0.0)' }
        ],
        negativeFill: isPrint ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.12)',
        unitLabel: isPrint ? '#666666' : 'rgba(255,255,255,0.3)'
    };

    ctx.clearRect(0, 0, W, H);
    // For print, fill white background to ensure transparency doesn't look gray if copied
    if (isPrint) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);
    }

    // Check if NISA variance data exists AND toggle is checked
    const showVariance = $('showVarianceToggle').checked;
    const hasVariance = showVariance && data.length > 0 && data[0].assetOptimistic !== undefined &&
        data.some(d => d.assetOptimistic !== d.asset || d.assetPessimistic !== d.asset);

    // Collect all data series (current + scenarios)
    const allSeries = [
        { assets: data.map(d => d.asset), color: '#6366f1', name: '現在', data }
    ];
    savedScenarios.forEach(s => {
        allSeries.push({
            assets: s.data.map(d => d.asset),
            color: s.color, // Color is hex, okay for print
            name: s.name,
            data: s.data
        });
    });

    // Calculate Y range across ALL series (including variance band)
    let globalMax = -Infinity, globalMin = Infinity;
    allSeries.forEach(s => {
        for (let i = 0; i < s.assets.length; i++) {
            if (s.assets[i] > globalMax) globalMax = s.assets[i];
            if (s.assets[i] < globalMin) globalMin = s.assets[i];
        }
    });
    if (hasVariance) {
        data.forEach(d => {
            if (d.assetOptimistic > globalMax) globalMax = d.assetOptimistic;
            if (d.assetPessimistic < globalMin) globalMin = d.assetPessimistic;
        });
    }
    globalMax = Math.max(globalMax, 0);
    globalMin = Math.min(globalMin, 0);
    // Include cash assets in range
    data.forEach(d => {
        if (d.cashAsset > globalMax) globalMax = d.cashAsset;
        if (d.cashAsset < globalMin) globalMin = d.cashAsset;
    });
    const range = globalMax - globalMin || 1;
    const padding = range * 0.1;
    const yMax = globalMax + padding;
    const yMin = globalMin - padding;
    const yRange = yMax - yMin;

    let maxLen = 0;
    for (let i = 0; i < allSeries.length; i++) {
        if (allSeries[i].assets.length > maxLen) maxLen = allSeries[i].assets.length;
    }

    function toX(i) { return pad.left + (i / (maxLen - 1)) * chartW; }
    function toY(v) { return pad.top + (1 - (v - yMin) / yRange) * chartH; }

    // Grid lines
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    const gridCount = 6;
    for (let i = 0; i <= gridCount; i++) {
        const v = yMin + (yRange * i) / gridCount;
        const gy = toY(v);
        ctx.beginPath();
        ctx.moveTo(pad.left, gy);
        ctx.lineTo(W - pad.right, gy);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(Math.round(v).toLocaleString(), pad.left - 8, gy + 4);
    }

    // X-axis labels (These are drawn twice maybe? No, let's just keep the lower one handling it. Let's remove this redundant one or adjust it too)
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    // Let's actually remove this block because "Draw Chart Axis Labels" already draws the labels below! (Line 2418+)
    // Doing it here just causes duplicate/messy drawing.

    // Zero line
    if (yMin < 0) {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(pad.left, toY(0));
        ctx.lineTo(W - pad.right, toY(0));
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Draw NISA variance band (before lines so it's behind)
    if (hasVariance) {
        const optAssets = data.map(d => d.assetOptimistic);
        const pesAssets = data.map(d => d.assetPessimistic);
        ctx.beginPath();
        for (let i = 0; i < optAssets.length; i++) {
            const x = toX(i);
            const y = toY(optAssets[i]);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        for (let i = pesAssets.length - 1; i >= 0; i--) {
            ctx.lineTo(toX(i), toY(pesAssets[i]));
        }
        ctx.closePath();
        ctx.fillStyle = colors.varianceFill;
        ctx.fill();

        // Draw dashed upper/lower bounds
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = colors.varianceStroke;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < optAssets.length; i++) {
            const x = toX(i); const y = toY(optAssets[i]);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.beginPath();
        for (let i = 0; i < pesAssets.length; i++) {
            const x = toX(i); const y = toY(pesAssets[i]);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Draw Chart Axis Labels (for PDF/Image export compatibility)
    // X-axis (Years/Ages)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = colors.text;
    ctx.font = '10px sans-serif';

    // Adjust label frequency based on chart width to prevent overlap on mobile
    let xSteps = 5;
    if (chartW < 400) xSteps = 10;
    else if (chartW < 600) xSteps = 8;

    for (let i = 0; i < data.length; i += xSteps) {
        const x = toX(i);
        if (x > pad.left) {
            ctx.fillText(data[i].year + '年', x, H - pad.bottom + 5);
            ctx.fillText(data[i].myAge + '歳', x, H - pad.bottom + 18);
        }
    }

    // Y-axis (Assets)
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const ySteps = 5;
    for (let i = 0; i <= ySteps; i++) {
        const val = globalMin + (globalMax - globalMin) * (i / ySteps);
        const y = toY(val);
        if (y < H - pad.bottom) {
            ctx.fillText((val / 10000).toFixed(0) + '億円', pad.left - 5, y);
        }
    }




    // Draw each series (scenarios first, current on top)
    const drawOrder = [...allSeries].reverse();
    drawOrder.forEach((series, seriesIdx) => {
        const assets = series.assets;
        const isCurrent = series.name === '現在';
        const alpha = isCurrent ? 1 : 0.6;

        // Gradient fill (only for current)
        if (isCurrent) {
            const grad = ctx.createLinearGradient(0, pad.top, 0, H - pad.bottom);
            grad.addColorStop(0, colors.currentFillStats[0].color);
            grad.addColorStop(0.5, colors.currentFillStats[0].color.replace(/[\d.]+\)$/, '0.06)')); // Approximate
            grad.addColorStop(1, colors.currentFillStats[1].color);

            ctx.beginPath();
            ctx.moveTo(toX(0), toY(0));
            for (let i = 0; i < assets.length; i++) {
                ctx.lineTo(toX(i), toY(assets[i]));
            }
            ctx.lineTo(toX(assets.length - 1), toY(0));
            ctx.closePath();
            ctx.fillStyle = grad;
            ctx.fill();
        }

        // Line
        ctx.beginPath();
        for (let i = 0; i < assets.length; i++) {
            const x = toX(i);
            const y = toY(assets[i]);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = series.color;
        ctx.lineWidth = isCurrent ? 2.5 : 2;
        ctx.lineJoin = 'round';
        ctx.globalAlpha = alpha;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Negative zone highlight (only current)
        if (isCurrent) {
            ctx.beginPath();
            let inNeg = false;
            for (let i = 0; i < assets.length; i++) {
                const x = toX(i);
                const y = toY(assets[i]);
                if (assets[i] < 0 && !inNeg) {
                    ctx.moveTo(x, toY(0));
                    ctx.lineTo(x, y);
                    inNeg = true;
                } else if (assets[i] < 0 && inNeg) {
                    ctx.lineTo(x, y);
                } else if (assets[i] >= 0 && inNeg) {
                    ctx.lineTo(x, toY(0));
                    inNeg = false;
                }
            }
            if (inNeg) ctx.lineTo(toX(assets.length - 1), toY(0));
            ctx.closePath();
            ctx.fillStyle = colors.negativeFill;
            ctx.fill();
        }
    });

    // --- Draw Cash Asset Line (green dashed) ---
    const cashAssets = data.map(d => d.cashAsset);
    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    for (let i = 0; i < cashAssets.length; i++) {
        const x = toX(i);
        const y = toY(cashAssets[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1.8;
    ctx.globalAlpha = 0.8;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    ctx.restore();

    // "万円" label
    ctx.fillStyle = colors.unitLabel;
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('（万円）', pad.left, pad.top - 10);

    // Event markers (current only)
    const eventColors = {
        birth: '#ec4899',
        housing: '#3b82f6',
        retirement: '#f59e0b',
        pension: '#10b981',
        quit: '#ef4444',
        nisa: '#06b6d4',
        ideco: '#a855f7',
        medical: '#fca5a5',
        wedding: '#f472b6',
        grandchild: '#fbbf24',
        car: '#22c55e'
    };
    const currentAssets = data.map(d => d.asset);
    data.forEach((row, i) => {
        row.events.forEach(ev => {
            if (eventColors[ev.type]) {
                const x = toX(i);
                const y = toY(currentAssets[i]);
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fillStyle = eventColors[ev.type];
                ctx.fill();
                ctx.beginPath();
                ctx.arc(x, y, 7, 0, Math.PI * 2);
                ctx.strokeStyle = eventColors[ev.type];
                ctx.lineWidth = 1;
                ctx.globalAlpha = 0.4;
                ctx.stroke();
                ctx.globalAlpha = 1;
            }
        });
    });

    // Chart legend (HTML below canvas)
    renderChartLegend(allSeries, hasVariance);

    // ===================================
    // Chart Tooltip
    // ===================================
    let tooltip = document.getElementById('chartTooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'chartTooltip';
        tooltip.className = 'chart-tooltip';
        tooltip.style.display = 'none';
        document.body.appendChild(tooltip);
    }

    const onMove = (e) => {
        const rect = canvas.getBoundingClientRect();
        // Mouse relative to canvas
        const mouseX = e.clientX - rect.left;

        // If out of chart area (roughly)
        if (mouseX < pad.left || mouseX > W - pad.right || e.clientY < rect.top || e.clientY > rect.bottom) {
            tooltip.style.display = 'none';
            return;
        }

        // Find index
        // toX(i) = pad.left + (i / (maxLen - 1)) * chartW
        // i = ((x - pad.left) / chartW) * (maxLen - 1)
        let idx = Math.round(((mouseX - pad.left) / chartW) * (maxLen - 1));
        idx = Math.max(0, Math.min(idx, data.length - 1));

        const d = data[idx];
        if (!d) return;

        // Build Tooltip HTML
        let tooltipHtml = `<span class="year-label">${d.year}年 (${d.myAge}歳)</span>`;

        // 1. Assets Comparison
        allSeries.forEach(s => {
            const sData = s.data[idx];
            if (sData) {
                const isCurrent = s.name === '現在';
                const val = Math.round(sData.asset).toLocaleString();
                const cashVal = Math.round(sData.cashAsset).toLocaleString();
                tooltipHtml += `
                <div class="row" style="margin-bottom:2px;">
                   <span style="background:${s.color}; width:8px; height:8px; display:inline-block; margin-right:6px; border-radius:50%;"></span>
                   <span class="label" style="flex:1;">${s.name} 累積</span>
                   <span class="value" style="${isCurrent ? 'font-weight:bold; color:var(--text-primary);' : ''}">${val}万</span>
                </div>`;
                if (isCurrent) {
                    tooltipHtml += `
                <div class="row" style="margin-bottom:2px;">
                   <span style="background:#10b981; width:8px; height:8px; display:inline-block; margin-right:6px; border-radius:50%;"></span>
                   <span class="label" style="flex:1;">キャッシュ</span>
                   <span class="value" style="font-weight:bold; color:#10b981;">${cashVal}万</span>
                </div>`;
                }
            }
        });

        // 2. Current Details (Income/Expense) separation
        tooltipHtml += `<div style="margin-top:6px; padding-top:4px; border-top:1px dashed rgba(255,255,255,0.15);">`;
        tooltipHtml += `<div class="row"><span class="label">世帯収入</span><span class="value">${Math.round(d.income).toLocaleString()}万</span></div>`;
        tooltipHtml += `<div class="row"><span class="label">支出合計</span><span class="value">${Math.round(d.expense).toLocaleString()}万</span></div>`;
        tooltipHtml += `</div>`;

        // 3. Events
        const eventsHtml = d.events.map(ev => `<div>${ev.label}</div>`).join('');
        if (eventsHtml) {
            tooltipHtml += `<div class="event">${eventsHtml}</div>`;
        }

        tooltip.innerHTML = tooltipHtml;

        tooltip.style.display = 'block';
        // Position: centered above cursor, but prevent overflow??
        // CSS handles centering (transform). 
        // We just set left/top to cursor position.
        tooltip.style.left = (e.pageX) + 'px';
        tooltip.style.top = (e.pageY - 15) + 'px';
    };

    // Remove old listeners? 
    // We are replacing the function property, so previous handler is gone.
    // However, we want to ensure we don't leak memory if drawChart is called often.
    // Assigning to onmousemove is safe.
    canvas.onmousemove = onMove;
    canvas.onmouseleave = () => { tooltip.style.display = 'none'; };
}

function renderChartLegend(allSeries, showVariance) {
    const legend = $('chartLegend');
    legend.innerHTML = '';
    allSeries.forEach(s => {
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = `<span class="legend-color" style="background:${s.color}"></span>${s.name}`;
        legend.appendChild(item);
    });
    if (showVariance) {
        const varianceItem = document.createElement('div');
        varianceItem.className = 'legend-item';
        varianceItem.innerHTML = `<span class="legend-color" style="background:rgba(99,102,241,0.25); border: 1px dashed rgba(99,102,241,0.6);"></span>NISA運用誤差範囲`;
        legend.appendChild(varianceItem);
    }
    // Cash legend item
    const cashItem = document.createElement('div');
    cashItem.className = 'legend-item';
    cashItem.innerHTML = `<span class="legend-color" style="background:#10b981; border: 1px dashed #10b981;"></span>キャッシュ残高`;
    legend.appendChild(cashItem);
}

// =============================================
// PIE CHART (Feature 3)
// =============================================
function renderExpensePieChart() {
    const canvas = document.getElementById('expensePieChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const exp = window.lifetimeExpenses;
    if (!exp) return;

    const labelsMap = {
        housing: '住居費',
        education: '教育費',
        living: '基本生活費',
        car: '自動車関連',
        insurance: '保険料',
        care: '医療・介護費',
        taxes: '税金・社会保険料',
        investment: '積立投資(NISA/iDeCo等)',
        other: 'その他支出(イベント等)'
    };

    const colorMap = {
        housing: '#3b82f6',
        education: '#10b981',
        living: '#f59e0b',
        car: '#fb923c',
        insurance: '#6366f1',
        care: '#ef4444',
        taxes: '#64748b',
        investment: '#06b6d4',
        other: '#a855f7'
    };

    const chartLabels = [];
    const chartData = [];
    const chartColors = [];
    let total = 0;

    Object.keys(exp).forEach(key => {
        if (exp[key] > 0) {
            chartLabels.push(labelsMap[key] || key);
            const val = Math.round(exp[key]);
            chartData.push(val);
            chartColors.push(colorMap[key] || '#94a3b8');
            total += val;
        }
    });

    if (window.expensePieChartInstance) {
        window.expensePieChartInstance.destroy();
    }

    const isDark = !document.body.classList.contains('print-mode'); // rough check

    window.expensePieChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: chartLabels,
            datasets: [{
                data: chartData,
                backgroundColor: chartColors,
                borderWidth: isDark ? 2 : 1,
                borderColor: isDark ? '#1a1a2e' : '#ffffff',
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: isDark ? '#e8e8f0' : '#333333',
                        font: { size: 11, family: 'Inter' }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const percentage = Math.round((value / total) * 100) + '%';
                            return `${label}: ${value.toLocaleString()}万円 (${percentage})`;
                        }
                    }
                }
            },
            cutout: '55%'
        }
    });
}

// =============================================
// LIFESTYLE COMPARISON (Feature 4)
// =============================================
function compareScenarios(type) {
    // Save current parameters to a temporary object to restore later
    const tempSave = {};
    document.querySelectorAll('input, select').forEach(el => {
        if (el.id && el.type !== 'button' && el.type !== 'submit') {
            tempSave[el.id] = el.type === 'checkbox' ? el.checked : el.value;
        }
    });

    // Clear existing generated scenarios
    clearScenarios();

    if (type === 'rent_vs_own') {
        // Scenario A: Rent
        $('housingToggle').checked = false;
        toggleHousing();
        const dataA = runSimulation();
        savedScenarios.push({ name: '賃貸プラン', data: dataA, color: '#ec4899' });

        // Scenario B: Own
        $('housingToggle').checked = true;
        toggleHousing();
        const radioHouse = document.querySelector('input[name="housingType"][value="house"]');
        if (radioHouse) radioHouse.checked = true;
        toggleHousingType();
        $('housingPrice').value = '5000';
        const dataB = runSimulation();
        savedScenarios.push({ name: '持ち家プラン(5000万)', data: dataB, color: '#3b82f6' });

    } else if (type === 'public_vs_private') {
        const childEntries = document.querySelectorAll('.child-entry');
        if (childEntries.length === 0) {
            alert('子供の情報を追加してから比較してください。');
            return;
        }

        // Scenario A: Public
        childEntries.forEach(entry => {
            entry.querySelectorAll('.edu-select').forEach(sel => sel.value = 'public');
            const juku = entry.querySelector('.juku-toggle');
            if (juku) { juku.checked = true; toggleJuku(juku); }
        });
        const dataA = runSimulation();
        savedScenarios.push({ name: 'オール公立プラン', data: dataA, color: '#10b981' });

        // Scenario B: Private
        childEntries.forEach(entry => {
            const k = entry.querySelector('.edu-k'); if (k) k.value = 'private';
            const e = entry.querySelector('.edu-e'); if (e) e.value = 'private';
            const j = entry.querySelector('.edu-j'); if (j) j.value = 'private';
            const h = entry.querySelector('.edu-h'); if (h) h.value = 'private';
            const u = entry.querySelector('.edu-u'); if (u) u.value = 'private_art';
        });
        const dataB = runSimulation();
        savedScenarios.push({ name: 'オール私立プラン', data: dataB, color: '#f59e0b' });

    } else if (type === 'work_vs_retire') {
        // Scenario A: Retire at 60
        $('myRetirementAge').value = '60';
        $('partnerRetirementAge').value = '60';
        const dataA = runSimulation();
        savedScenarios.push({ name: '60歳退職プラン', data: dataA, color: '#6366f1' });

        // Scenario B: Retire at 65
        $('myRetirementAge').value = '65';
        $('partnerRetirementAge').value = '65';
        const dataB = runSimulation();
        savedScenarios.push({ name: '65歳退職プラン', data: dataB, color: '#10b981' });

    }

    // Restore original inputs
    document.querySelectorAll('input, select').forEach(el => {
        if (el.id && el.type !== 'button' && el.type !== 'submit' && tempSave[el.id] !== undefined) {
            if (el.type === 'checkbox') {
                el.checked = tempSave[el.id];
            } else {
                el.value = tempSave[el.id];
            }
        }
    });

    // Re-trigger toggles
    toggleHousing();
    toggleHousingType();

    // Calculate current and render
    const currentData = runSimulation();
    renderResults(currentData);

    // Scroll to results
    setTimeout(() => {
        const compCard = document.getElementById('comparisonCard');
        if (compCard) compCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
}


// =============================================
// EXPORT: CSV
// =============================================

function exportCSV() {
    const data = runSimulation();
    const BOM = '\uFEFF';

    // Dynamic Headers
    const numChildren = (data.length > 0 && data[0].childAges) ? data[0].childAges.length : 0;
    const basicHeaders = ['年度', 'あなたの年齢', 'パートナーの年齢'];
    const childHeaders = [];
    for (let c = 0; c < numChildren; c++) childHeaders.push(`第${c + 1}子年齢`);
    const gcHeaders = [];
    for (let c = 0; c < numChildren; c++) gcHeaders.push(`孫(第${c + 1}子)年齢`);
    const financialHeaders = ['世帯収入（万円）', '支出合計（万円）', '年間収支（万円）', 'キャッシュ（万円）', '累積資産（万円）', 'NISA残高（万円）', 'iDeCo残高（万円）', 'NISA自動取崩（万円）', 'ライフイベント'];

    const headers = [...basicHeaders, ...childHeaders, ...gcHeaders, ...financialHeaders];

    const rows = data.map(d => {
        const cAges = d.childAges ? d.childAges.map(a => a !== null ? a : '') : [];
        const gcAges = d.grandchildAges ? d.grandchildAges.map(a => a !== null && a >= 0 ? a : '') : [];
        return [
            d.year,
            d.myAge,
            d.partnerAge,
            ...cAges,
            ...gcAges,
            d.income,
            d.expense,
            d.cashflow,
            d.cashAsset,
            d.asset,
            d.nisaBalance,
            d.idecoBalance,
            d.nisaAutoSell,
            d.events.map(e => e.label).join(' / ')
        ];
    });
    const csv = BOM + [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ライフプラン_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// =============================================
// EXPORT: PDF / Image (html2canvas & jspdf)
// =============================================
async function exportToPDF() {
    if (!window.jspdf || !window.html2canvas) {
        alert("PDF生成ライブラリを読み込み中です。数秒後にお試しください。");
        return;
    }

    const { jsPDF } = window.jspdf;
    const element = document.getElementById('resultsSection');

    // Add print styling briefly
    document.body.classList.add('print-mode');

    try {
        const canvas = await html2canvas(element, {
            scale: 2, // improve quality
            useCORS: true,
            logging: false,
            ignoreElements: (el) => el.classList.contains('no-print') // hide export buttons
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`ライフプランレポート_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
        console.error("PDF Export failed", e);
        alert("PDFの生成に失敗しました。");
    } finally {
        document.body.classList.remove('print-mode');
    }
}

async function exportImage() {
    if (!window.html2canvas) {
        alert("画像生成ライブラリを読み込み中です。数秒後にお試しください。");
        return;
    }

    const element = document.getElementById('resultsSection');
    document.body.classList.add('print-mode');

    try {
        const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            ignoreElements: (el) => el.classList.contains('no-print')
        });

        const link = document.createElement('a');
        link.download = `ライフプラン_${new Date().toISOString().slice(0, 10)}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (e) {
        console.error("Image Export failed", e);
        alert("画像の生成に失敗しました。");
    } finally {
        document.body.classList.remove('print-mode');
    }
}

// Keep regular browser print as fallback
function exportPDF() {
    window.print();
}

// =============================================
// EVENTS
// =============================================

$('planForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const data = runSimulation();
    renderResults(data);
});

let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        if (!$('resultsSection').classList.contains('hidden')) {
            const data = runSimulation();
            drawChart(data);
        }
    }, 200);
});

// =============================================
// SHARE & SAVE
// =============================================

function generateShareLink() {
    const params = new URLSearchParams();

    // 1. Standard inputs (checkboxes, numbers, selects with IDs)
    document.querySelectorAll('input, select').forEach(el => {
        // Skip child-specific inputs which are handled separately
        if (el.id && el.type !== 'submit' && el.type !== 'button' && !el.closest('.child-entry')) {
            if (el.type === 'checkbox') {
                params.set(el.id, el.checked ? '1' : '0');
            } else if (el.type === 'radio') {
                // Radios handled by name check
            } else {
                params.set(el.id, el.value);
            }
        }
    });

    // 2. Radio: Housing Type
    const housingType = document.querySelector('input[name="housingType"]:checked');
    if (housingType) params.set('housingType', housingType.value);

    // 3. Children Detailed Data
    const childrenData = [];
    document.querySelectorAll('.child-entry').forEach(entry => {
        const edu = {};
        const eduSelects = entry.querySelectorAll('.edu-select');
        eduSelects.forEach(s => {
            // Class name is like 'edu-select edu-k', need to extract 'k', 'e', etc.
            // Or just use classList check
            if (s.classList.contains('edu-k')) edu.k = s.value;
            if (s.classList.contains('edu-e')) edu.e = s.value;
            if (s.classList.contains('edu-j')) edu.j = s.value;
            if (s.classList.contains('edu-h')) edu.h = s.value;
            if (s.classList.contains('edu-u')) edu.u = s.value;
        });

        childrenData.push({
            year: entry.querySelector('.child-year-input').value,
            edu: edu,
            juku: {
                active: entry.querySelector('.juku-toggle').checked ? 1 : 0,
                cost: entry.querySelector('.juku-cost').value,
                start: entry.querySelector('.juku-start').value,
                end: entry.querySelector('.juku-end').value
            }
        });
    });
    // Serialize
    params.set('children', JSON.stringify(childrenData));

    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?${params.toString()}`;
}

function loadFromUrl() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('myAge')) return;

    // 1. Standard inputs
    document.querySelectorAll('input, select').forEach(el => {
        if (el.id && params.has(el.id)) {
            const val = params.get(el.id);
            if (el.type === 'checkbox') {
                el.checked = val === '1';
                // Trigger toggles
                if (el.id === 'housingToggle') toggleHousing();
                if (el.id === 'carToggle') toggleCar();
                if (el.id === 'myEarlyRetirement') toggleEarlyRetirement('my');
                if (el.id === 'partnerEarlyRetirement') toggleEarlyRetirement('partner');
                if (el.id === 'nisaToggle') toggleNisa();
                if (el.id === 'nisaSellToggle') toggleNisaSell();
                if (el.id === 'idecoToggle') toggleIdeco();
                if (el.id === 'idecoPartnerActive') toggleIdecoPartner();
                if (el.id === 'weddingToggle') toggleWedding();
            } else {
                el.value = val;
                if (el.id === 'nisaSellType') toggleNisaSellType();
            }
        }
    });

    // 2. Housing Type
    if (params.has('housingType')) {
        const val = params.get('housingType');
        const radio = document.querySelector(`input[name="housingType"][value="${val}"]`);
        if (radio) {
            radio.checked = true;
            toggleHousingType();
        }
    }

    // 3. Restore Children
    if (params.has('children')) {
        try {
            const childrenData = JSON.parse(params.get('children'));
            const container = $('childrenContainer');
            container.innerHTML = '';
            childCount = 0;
            updateAddButton();

            childrenData.forEach(c => {
                addChild();
                const entry = container.lastElementChild;
                entry.querySelector('.child-year-input').value = c.year;

                if (c.edu) {
                    if (c.edu.k) entry.querySelector('.edu-k').value = c.edu.k;
                    if (c.edu.e) entry.querySelector('.edu-e').value = c.edu.e;
                    if (c.edu.j) entry.querySelector('.edu-j').value = c.edu.j;
                    if (c.edu.h) entry.querySelector('.edu-h').value = c.edu.h;
                    if (c.edu.u) entry.querySelector('.edu-u').value = c.edu.u;
                }

                if (c.juku) {
                    const toggle = entry.querySelector('.juku-toggle');
                    toggle.checked = c.juku.active == 1;
                    entry.querySelector('.juku-cost').value = c.juku.cost;
                    entry.querySelector('.juku-start').value = c.juku.start;
                    entry.querySelector('.juku-end').value = c.juku.end;
                    toggleJuku(toggle);
                }
            });
        } catch (e) {
            console.error('Failed to parse children', e);
        }
    } else if (params.has('childYears')) {
        // Fallback for simple format
        const yearsStr = params.get('childYears');
        if (yearsStr) {
            $('childrenContainer').innerHTML = '';
            childCount = 0;
            updateAddButton();
            const years = yearsStr.split(',');
            years.forEach(y => {
                if (!y) return;
                addChild();
                const inputs = document.querySelectorAll('.child-year-input');
                inputs[inputs.length - 1].value = y;
            });
        }
    }

    const data = runSimulation();
    renderResults(data);
}

function getShareSummaryText() {
    const data = window.lastSimulationData;
    if (!data || data.length === 0) return '';
    const peakAsset = Math.max(...data.map(d => d.asset));
    const finalAsset = data[data.length - 1].asset;
    const negativeYear = data.find(d => d.asset < 0);
    let summary = '\n\n【シミュレーション結果】';
    summary += `\n最大資産額: ${peakAsset.toLocaleString()}万円`;
    summary += `\n100歳時点: ${finalAsset.toLocaleString()}万円`;
    summary += `\n資金ショート: ${negativeYear ? negativeYear.myAge + '歳(' + negativeYear.year + '年)' : 'なし ✓'}`;
    return summary;
}

function shareViaLine() {
    const url = generateShareLink();
    const summary = getShareSummaryText();
    const text = '家族のライフプランをシミュレーションしました。' + summary + '\n\n▼ 詳細はこちら\n' + url;

    // Detect mobile for native LINE app
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
        // Use LINE native app URL scheme
        window.location.href = `line://msg/text/${encodeURIComponent(text)}`;
    } else {
        // Use LINE social plugin share URL for desktop
        const shareUrl = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
        window.open(shareUrl, '_blank', 'width=600,height=500');
    }
}

function shareViaEmail() {
    const url = generateShareLink();
    const summary = getShareSummaryText();
    const subject = 'ライフプランシミュレーション結果の共有';
    const body = `シミュレーション結果を作成しました。${summary}\n\n▼ 詳細はこちら\n${url}`;
    const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
}

// Check URL on load
window.addEventListener('DOMContentLoaded', loadFromUrl);

function applyAdvice(type, value) {
    let targetElement = null;

    if (type === 'nisa_increase' || type === 'nisa_start') {
        const nisaMonthly = $('nisaMonthlyMy');
        if (type === 'nisa_start') {
            nisaMonthly.value = value;
        } else {
            const current = parseFloat(nisaMonthly.value) || 0;
            nisaMonthly.value = current + value;
        }
        targetElement = nisaMonthly;

        // Ensure NISA is on
        const toggle = $('nisaToggle');
        if (!toggle.checked) toggle.click();
    } else if (type === 'ideco_start') {
        const idecoMonthly = $('idecoMonthlyMy');
        idecoMonthly.value = value;
        targetElement = idecoMonthly;
        // Ensure iDeCo is on
        const toggle = $('idecoToggle');
        if (!toggle.checked) toggle.click();
    } else if (type === 'car_review') {
        const carCycle = $('carCycle');
        const current = parseFloat(carCycle.value) || 7;
        carCycle.value = current + value;
        targetElement = carCycle;
    } else if (type === 'living_cost_reduce') {
        const rent = $('monthlyRent');
        const other = $('monthlyOther');
        const factor = (100 - value) / 100;
        if (parseFloat(rent.value) > 0) rent.value = Math.round(parseFloat(rent.value) * factor);
        if (parseFloat(other.value) > 0) other.value = Math.round(parseFloat(other.value) * factor);
        targetElement = parseFloat(rent.value) > 0 ? rent : other;
    } else if (type === 'housing_review') {
        const housing = $('housingPrice');
        housing.value = Math.max(0, parseFloat(housing.value) - value);
        targetElement = housing;
    } else if (type === 'insurance_review') {
        const ins = $('lifeInsurance');
        ins.value = value;
        targetElement = ins;
    } else if (type === 'education_review') {
        const selects = document.querySelectorAll('.child-entry .edu-select');
        selects.forEach(sel => {
            if (sel.value.includes('private')) {
                if (sel.classList.contains('edu-u')) {
                    sel.value = 'public_home';
                } else {
                    sel.value = 'public';
                }
                targetElement = sel;
            }
        });
        if (!targetElement && selects.length > 0) targetElement = selects[0];
    } else if (type === 'retirement_extend') {
        const ret = $('myRetAge'); // Note: ID might be myRetirementAge, checking usage below
        if (ret) {
            ret.value = value;
            targetElement = ret;
        } else {
            // Check HTML ID for retirement age
            const ret2 = $('myRetirementAge'); // Often used ID
            if (ret2) {
                ret2.value = value;
                targetElement = ret2;
            }
        }
    } else if (type === 'partner_retirement_extend') {
        const ret = $('partnerRetAge');
        if (ret) {
            ret.value = value;
            targetElement = ret;
        } else {
            const ret2 = $('partnerRetirementAge');
            if (ret2) {
                ret2.value = value;
                targetElement = ret2;
            }
        }
    } else if (type === 'partner_income_boost') {
        const pi = $('partnerIncome');
        pi.value = parseFloat(pi.value) + value;
        targetElement = pi;
    } else if (type === 'partner_work_start') {
        const pi = $('partnerIncome');
        pi.value = value;
        targetElement = pi;
    }

    if (targetElement) {
        // Highlight effect
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetElement.classList.add('highlight-change');
        setTimeout(() => targetElement.classList.remove('highlight-change'), 2000);

        // Run sim after a delay
        setTimeout(() => {
            if (typeof autoCalculate === 'function') {
                autoCalculate();
            } else {
                const data = runSimulation();
                renderResults(data, true);
            }
        }, 1000);
    }
}

// Make globally available
window.applyAdvice = applyAdvice;

// =============================================
// BREAKDOWN MODAL
// =============================================

function showBreakdown(index, type) {
    const data = window.lastSimulationData[index];
    if (!data || !data.breakdown) {
        console.error("No breakdown data for index", index);
        alert("詳細データがありません。シミュレーションを再実行してください。");
        return;
    }

    const bd = data.breakdown[(type === 'income' ? 'income' : 'expense')];
    if (!bd) return;

    const isIncome = type === 'income';
    const title = `${data.year}年 (${data.myAge}歳) の${isIncome ? '収入' : '支出'}内訳`;

    // Map keys to labels
    const labelsMap = isIncome ? {
        salaryMy: '夫収入(手取り)',
        salaryPartner: '妻収入(手取り)',
        pensionMy: '夫年金',
        pensionPartner: '妻年金',
        assetReturn: '資産取り崩し/iDeCo/NISA',
        other: 'その他(手当/退職金/還付)'
    } : {
        living: '基本生活費',
        housing: '住宅関連(ローン/管理費/税)',
        education: '教育費',
        car: '自動車関連',
        insurance: '保険料',
        care: '介護費用',
        event: 'イベント/祝い金',
        investment: '積立投資(NISA/iDeCo)',
        other: 'その他支出'
    };

    let rowsHtml = '';
    let total = 0;

    // Ordered keys if needed, or iterate object
    Object.keys(labelsMap).forEach(key => {
        const val = bd[key];
        if (Math.round(val) > 0) {
            rowsHtml += `
                <div class="breakdown-row">
                    <span class="breakdown-label">${labelsMap[key]}</span>
                    <span class="breakdown-value">${Math.round(val).toLocaleString()} 万円</span>
                </div>
            `;
            total += val;
        }
    });

    // Create modal element
    const modal = document.createElement('div');
    modal.className = 'breakdown-modal active';
    modal.id = 'breakdownModal';
    modal.onclick = (e) => closeBreakdown(e); // Click outside closes

    modal.innerHTML = `
        <div class="breakdown-content" onclick="event.stopPropagation()">
            <div class="breakdown-header">
                <h3>${title}</h3>
                <button class="close-modal" onclick="closeBreakdown()">×</button>
            </div>
            <div style="position: relative; height: 180px; width: 100%; margin-bottom: 1rem; display: flex; justify-content: center;">
                <canvas id="breakdownChart"></canvas>
            </div>
            <div class="breakdown-list">
                ${rowsHtml || '<div class="breakdown-row" style="text-align:center; color:#888;">内訳データなし</div>'}
            </div>
            <div class="breakdown-total">
                <span style="color:var(--text-primary)">合計</span>
                <span>${Math.round(total).toLocaleString()} 万円</span>
            </div>
             ${(isIncome && data.breakdown.investmentGrowth > 0.5) ? `
             <div style="margin-top: 1rem; padding-top: 0.5rem; border-top: 1px dashed rgba(255,255,255,0.1); font-size: 0.9rem; color: #10b981;">
                <div style="display:flex; justify-content:space-between;">
                    <span>(参考) 年間運用益 (含み益)</span>
                    <span>+${Math.round(data.breakdown.investmentGrowth).toLocaleString()} 万円</span>
                </div>
                <div style="font-size:0.75rem; opacity:0.8; margin-top:2px;">※資産残高の増加分であり、キャッシュフロー（収入）には含まれません</div>
            </div>` : ''}
        </div>
    `;

    // Remove existing
    const existing = document.getElementById('breakdownModal');
    if (existing) closeBreakdown();

    document.body.appendChild(modal);

    // Draw Chart
    const ctx = document.getElementById('breakdownChart').getContext('2d');
    const chartLabels = [];
    const chartData = [];
    const chartColors = [];

    // Define Colors
    const colorPalette = {
        salaryMy: '#3b82f6', salaryPartner: '#ec4899', pensionMy: '#10b981', pensionPartner: '#a855f7', assetReturn: '#f59e0b', other: '#64748b',
        living: '#3b82f6', housing: '#ec4899', education: '#10b981', car: '#f59e0b', insurance: '#6366f1', care: '#ef4444', event: '#f472b6', investment: '#06b6d4'
    };

    Object.keys(labelsMap).forEach(key => {
        const val = bd[key];
        if (Math.round(val) > 0) {
            chartLabels.push(labelsMap[key]);
            chartData.push(Math.round(val));
            chartColors.push(colorPalette[key] || '#94a3b8');
        }
    });

    if (window.currentBreakdownChart) {
        window.currentBreakdownChart.destroy();
    }

    if (chartData.length > 0) {
        window.currentBreakdownChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: chartLabels,
                datasets: [{
                    data: chartData,
                    backgroundColor: chartColors,
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false // Hide legend to save space, list is below
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const percentage = Math.round((value / total) * 100) + '%';
                                return `${label}: ${value.toLocaleString()}万円 (${percentage})`;
                            }
                        }
                    }
                },
                cutout: '60%'
            }
        });
    }
}

function closeBreakdown(e) {
    if (e && e.target.id !== 'breakdownModal') return;

    const modal = document.getElementById('breakdownModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    }

    if (window.currentBreakdownChart) {
        window.currentBreakdownChart.destroy();
        window.currentBreakdownChart = null;
    }
}

// Expose to window scope explicitly just in case
window.showBreakdown = showBreakdown;
window.closeBreakdown = closeBreakdown;
function toggleIdecoPartner() {
    const active = $('idecoPartnerActive').checked;
    const fields = $('idecoPartnerFields');
    const inputs = fields.querySelectorAll('input, select');

    if (active) {
        fields.style.opacity = '1';
        fields.style.pointerEvents = 'auto';
        inputs.forEach(el => el.disabled = false);
    } else {
        fields.style.opacity = '0.5';
        fields.style.pointerEvents = 'none';
        inputs.forEach(el => el.disabled = true);
    }
    runSimulation();
}

// Initial call (since default is unchecked in HTML now)
setTimeout(toggleIdecoPartner, 0);

function scrollToChart() {
    const data = runSimulation();
    renderResults(data);
}


// --- UI Enhancements: Tabs & Sticky Summary ---

// Tab Switching
function switchTab(tabId) {
    // Update Nav
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Update Cards
    // Only target cards specifically with tab classes
    const allCards = document.querySelectorAll('.card');
    let found = false;
    allCards.forEach(card => {
        // Check if card has any tab class
        if (card.className.includes('tab-')) {
            if (card.classList.contains(tabId)) {
                card.classList.remove('hidden');
                card.style.display = 'block';
                // Simple fade in
                card.style.opacity = '0';
                setTimeout(() => card.style.opacity = '1', 10);
                found = true;
            } else {
                card.style.display = 'none';
            }
        }
    });
}

// Sticky Summary Update
function updateStickySummary() {
    const data = window.lastSimulationData;
    if (!data || data.length === 0) return;

    // Check if results are visible
    const resultsSection = document.getElementById('resultsSection');
    const sticky = document.getElementById('stickySummary');

    if (!resultsSection || resultsSection.classList.contains('hidden')) {
        if (sticky) sticky.classList.remove('visible');
        return;
    }

    if (sticky) sticky.classList.add('visible');

    // Calc Data
    const negativeYear = data.find(d => d.cashAsset < 0);
    const finalAsset = data[data.length - 1].asset;

    const assetLifeEl = document.getElementById('stickyAssetLife');
    const endBalanceEl = document.getElementById('stickyEndBalance');

    if (assetLifeEl) {
        if (negativeYear) {
            assetLifeEl.textContent = `${negativeYear.myAge}歳`;
            assetLifeEl.style.color = '#fca5a5'; // Negative color
        } else {
            assetLifeEl.textContent = '100歳+';
            assetLifeEl.style.color = '#10b981'; // Positive color
        }
    }

    if (endBalanceEl) {
        endBalanceEl.textContent = `${finalAsset.toLocaleString()}万円`;
        endBalanceEl.style.color = finalAsset >= 0 ? '#10b981' : '#fca5a5';
    }
}

// Patch renderResults to trigger summary update
if (!window.renderResultsPatched) {
    // We assume renderResults is defined in the global scope
    if (typeof renderResults !== 'undefined') {
        const originalRenderResults = renderResults;
        renderResults = function (data, skipScroll) {
            originalRenderResults(data, skipScroll);
            updateStickySummary();
        };
        window.renderResultsPatched = true;
    }
}

/* --- Auto-Calculation Logic --- */
const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
};

function autoCalculate() {
    // Check if results are visible (or effectively active)
    if (!$('resultsSection').classList.contains('hidden')) {
        const data = runSimulation();
        // Call the (potentially patched) renderResults with skipScroll=true
        renderResults(data, true);
    }
}

// Attach listeners
const planForm = document.getElementById('planForm');
if (planForm) {
    planForm.addEventListener('input', debounce(autoCalculate, 500));
    planForm.addEventListener('change', autoCalculate); // Immediate for select/checkbox
}

// Initialize Tabs on Load
window.addEventListener('DOMContentLoaded', () => {
    switchTab('tab-basic'); // Default tab

    // Handle form submit to prevent reload if not prevented
    const form = document.getElementById('planForm');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const data = runSimulation();
            if (data) {
                renderResults(data);
            }
        });
    }
});

// --- Feature 2: Timeline Rendering (Visual Gantt Style) ---
function renderTimeline(data) {
    const container = $('timelineContainer');
    if (container) container.innerHTML = '';

    // Check data
    if (!data || data.length === 0) return;

    // Legend
    const legend = document.createElement('div');
    legend.className = 'timeline-legend';
    legend.innerHTML = `
        <span class="legend-item"><span class="legend-dot education"></span>教育期間</span>
        <span class="legend-item"><span class="legend-dot working"></span>現役期間</span>
        <span class="legend-item"><span class="legend-dot retirement"></span>セカンドライフ</span>
        <span class="legend-item"><span class="legend-dot event"></span>イベント</span>
    `;
    container.appendChild(legend);

    // Wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'timeline-wrapper nice-scrollbar'; // Horizontal scroll

    const table = document.createElement('table');
    table.className = 'timeline-table visual-timeline';

    // Header
    const thead = document.createElement('thead');
    const trHead = document.createElement('tr');

    // Corner
    const thCorner = document.createElement('th');
    thCorner.textContent = 'Year';
    thCorner.className = 'timeline-sticky-corner';
    trHead.appendChild(thCorner);

    data.forEach(d => {
        const th = document.createElement('th');
        // Only show year number every 5 years or if event exists?
        // Let's show all but small (vertical?) or just every 5
        const isMajor = d.year % 5 === 0 || d.events.length > 0;
        th.innerHTML = `<div>${d.year}</div>`;
        th.className = `timeline-header-year ${d.events.length > 0 ? 'has-event' : ''}`;
        if (!isMajor) th.classList.add('minor-year');
        trHead.appendChild(th);
    });
    thead.appendChild(trHead);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    // Helper: Determine Stage Class
    const getStageClass = (role, age) => {
        if (role === 'child') {
            if (age <= 6) return 'stage-preschool'; // 0-6
            if (age <= 12) return 'stage-elementary'; // 7-12
            if (age <= 15) return 'stage-middle'; // 13-15
            if (age <= 18) return 'stage-high'; // 16-18
            if (age <= 22) return 'stage-college'; // 19-22
            return 'stage-working'; // 23+
        }
        if (role === 'grandchild') {
            if (age < 0) return '';
            if (age <= 22) return 'stage-education'; // Simplified
            return 'stage-working';
        }
        // Adult
        if (age < 60) return 'stage-working'; // Assuming 60 for simplicity or use param
        if (age < 70) return 'stage-reemployment'; // 60-70
        return 'stage-retirement'; // 70+
    };

    // Helper: Add Row
    const addRow = (label, role, ageAccessor) => {
        const tr = document.createElement('tr');
        const tdLabel = document.createElement('td');
        tdLabel.textContent = label;
        tdLabel.className = 'timeline-sticky-col';
        tr.appendChild(tdLabel);

        data.forEach(d => {
            const age = ageAccessor(d);
            const td = document.createElement('td');

            if (age !== null && age !== undefined && age >= 0) {
                const stage = getStageClass(role, age);
                td.className = `timeline-cell ${stage}`;

                // Show age? Yes, but small.
                // If it's a major year or event year, make it bold/visible.
                // Otherwise faint.
                td.innerHTML = `<span class="age-val">${age}</span>`;
            } else {
                td.className = 'timeline-cell empty';
                td.textContent = '';
            }

            // Highlight if vertical event spans all? No, row specific logic is for visuals.
            // But we want to indicate if *this person* has an event? 
            // The events array is global for the year currently in structure (mostly).
            // Actually events often have labels like "Child 1 Birth".
            // For now, no specific event filtering per row, just stage visualization.

            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    };

    // Row: Me
    addRow('あなた', 'adult', d => d.myAge);
    // Row: Partner
    addRow('Partner', 'adult', d => d.partnerAge); // "Partner" short for design or "妻/夫"? "パートナー"

    // Children
    const numChildren = (data.length > 0 && data[0].childAges) ? data[0].childAges.length : 0;
    for (let c = 0; c < numChildren; c++) {
        addRow(`第${c + 1}子`, 'child', d => d.childAges[c]);
    }

    // Events Row (The most important one)
    const trEvt = document.createElement('tr');
    trEvt.className = 'timeline-event-row';
    const tdEvtLabel = document.createElement('td');
    tdEvtLabel.innerHTML = 'イベント';
    tdEvtLabel.className = 'timeline-sticky-col';
    trEvt.appendChild(tdEvtLabel);

    data.forEach(d => {
        const td = document.createElement('td');
        td.className = 'timeline-cell event-cell-container';
        if (d.events.length > 0) {
            td.classList.add('has-event-marker');
            const iconMap = { birth: '👶', housing: '🏠', car: '🚗', retirement: '💐', wedding: '💒', nisa: '💰', ideco: '🏦', grandchild: '🧸', education: '🎓', default: '📌' };

            // Show stacking icons if multiple
            const icons = d.events.map(e => {
                const i = iconMap[e.type] || iconMap.default;
                return `<span class="u-icon" title="${e.label}">${i}</span>`;
            }).join('');
            td.innerHTML = `<div class="event-stack">${icons}</div>`;
        }
        trEvt.appendChild(td);
    });
    tbody.appendChild(trEvt);

    table.appendChild(tbody);
    wrapper.appendChild(table);
    container.appendChild(wrapper);
}

// --- Feature 4: Comparison Rendering ---
function renderComparison(currentData) {
    const table = $('comparisonTable');
    if (!table) return;
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');

    // Headers
    let headerHtml = '<tr><th>項目</th>';
    headerHtml += `<th>今回 (<span class="scenario-header-dot" style="background:${SCENARIO_COLORS[savedScenarios.length % SCENARIO_COLORS.length]}"></span>Current)</th>`;
    savedScenarios.forEach(sc => {
        headerHtml += `<th>${sc.name} <button class="remove-scenario" style="float:right; border:none; background:none; color:var(--negative); cursor:pointer;" onclick="removeScenarioByName('${sc.name}')">×</button></th>`;
    });
    headerHtml += '</tr>';
    thead.innerHTML = headerHtml;

    // Helper to get stats
    const getStats = (d) => {
        const assets = d.map(r => r.asset);
        const max = Math.max(...assets);
        const min = Math.min(...assets);
        const end = assets[assets.length - 1];
        const shortage = d.find(r => r.asset < 0);
        return { max, min, end, shortageYear: shortage ? shortage.year : null };
    };

    const curStats = getStats(currentData);
    const scenStats = savedScenarios.map(s => ({ name: s.name, stats: getStats(s.data) }));

    let bodyHtml = '';

    // Row 1: Max Asset
    bodyHtml += `<tr><td>最大資産</td><td>${curStats.max.toLocaleString()}万</td>`;
    scenStats.forEach(s => {
        const diff = s.stats.max - curStats.max; // Scenario - Current (or Current - Scenario? usually Compare vs Current)
        // Let's show S vs Current diff
        const diffStr = diff === 0 ? '' : `<span class="diff-val ${diff > 0 ? 'positive' : 'negative'}">(${diff > 0 ? '+' : ''}${diff.toLocaleString()})</span>`;
        bodyHtml += `<td>${s.stats.max.toLocaleString()}万 ${diffStr}</td>`;
    });
    bodyHtml += '</tr>';

    // Row 2: Min Asset
    bodyHtml += `<tr><td>最小資産</td><td class="${curStats.min < 0 ? 'negative' : ''}">${curStats.min.toLocaleString()}万</td>`;
    scenStats.forEach(s => {
        const diff = s.stats.min - curStats.min;
        const diffStr = diff === 0 ? '' : `<span class="diff-val ${diff > 0 ? 'positive' : 'negative'}">(${diff > 0 ? '+' : ''}${diff.toLocaleString()})</span>`;
        bodyHtml += `<td class="${s.stats.min < 0 ? 'negative' : ''}">${s.stats.min.toLocaleString()}万 ${diffStr}</td>`;
    });
    bodyHtml += '</tr>';

    // Row 3: 100yr Asset
    bodyHtml += `<tr><td>100歳時点</td><td class="${curStats.end < 0 ? 'negative' : ''}">${curStats.end.toLocaleString()}万</td>`;
    scenStats.forEach(s => {
        const diff = s.stats.end - curStats.end;
        const diffStr = diff === 0 ? '' : `<span class="diff-val ${diff > 0 ? 'positive' : 'negative'}">(${diff > 0 ? '+' : ''}${diff.toLocaleString()})</span>`;
        bodyHtml += `<td class="${s.stats.end < 0 ? 'negative' : ''}">${s.stats.end.toLocaleString()}万 ${diffStr}</td>`;
    });
    bodyHtml += '</tr>';

    // Row 4: Shortage
    bodyHtml += `<tr><td>資金ショート</td><td>${curStats.shortageYear ? curStats.shortageYear + '年' : 'なし'}</td>`;
    scenStats.forEach(s => {
        bodyHtml += `<td>${s.stats.shortageYear ? s.stats.shortageYear + '年' : 'なし'}</td>`;
    });
    bodyHtml += '</tr>';

    tbody.innerHTML = bodyHtml;
}

function removeScenarioByName(name) {
    const idx = savedScenarios.findIndex(s => s.name === name);
    if (idx >= 0) {
        savedScenarios.splice(idx, 1);
        runSimulation(); // re-render
    }
}

// --- Feature 1: Browser Save/Load ---
const SAVE_KEY = 'family_finance_plan_v1';

function saveData() {
    const data = {
        inputs: {},
        checkboxes: {},
        children: [],
        customEvents: [],
        scenarios: savedScenarios || []
    };

    // 1. Static Inputs (IDs)
    // Exclude dynamic inputs (no ID or inside dynamic containers) - simplest filter is asking for ID
    const allInputs = document.querySelectorAll('input[id], select[id], textarea[id]');
    allInputs.forEach(el => {
        if (!el.id) return;
        if (el.type === 'checkbox') {
            data.checkboxes[el.id] = el.checked;
        } else {
            data.inputs[el.id] = el.value;
        }
    });

    // Save the dynamic mortgage array instead of futureLoanRate
    data.inputs['mortgageReviews'] = JSON.stringify(getMortgageReviews());

    // 2. Children
    const childEntries = document.querySelectorAll('.child-entry');
    childEntries.forEach(entry => {
        const mode = entry.dataset.mode;
        const entryData = {
            mode: mode,
            // Mode specific
            ageInput: entry.querySelector('.child-age-input')?.value,
            yearInput: entry.querySelector('.child-year-input')?.value,
            // Edu
            edu_k: entry.querySelector('.edu-k')?.value,
            edu_e: entry.querySelector('.edu-e')?.value,
            edu_j: entry.querySelector('.edu-j')?.value,
            edu_h: entry.querySelector('.edu-h')?.value,
            edu_u: entry.querySelector('.edu-u')?.value,
            // Juku
            juku_active: entry.querySelector('.juku-toggle')?.checked,
            juku_cost: entry.querySelector('.juku-cost')?.value,
            juku_start: entry.querySelector('.juku-start')?.value,
            juku_end: entry.querySelector('.juku-end')?.value
        };
        data.children.push(entryData);
    });

    // 3. Custom Events
    data.customEvents = getCustomEvents();

    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

function loadData() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;

    try {
        const data = JSON.parse(raw);

        // 1. Static Inputs
        // Restore toggles first (might affect visibility)
        for (const [id, checked] of Object.entries(data.checkboxes || {})) {
            const el = document.getElementById(id);
            if (el) {
                el.checked = checked;
                el.dispatchEvent(new Event('change')); // Trigger toggle logic
            }
        }
        for (const [id, val] of Object.entries(data.inputs || {})) {
            if (id === 'mortgageReviews') continue; // Handled separately
            const el = document.getElementById(id);
            if (el) {
                el.value = val;
            }
        }

        clearMortgageReviews();
        if (data.inputs && data.inputs['mortgageReviews']) {
            try {
                const reviews = JSON.parse(data.inputs['mortgageReviews']);
                if (reviews && reviews.length > 0) {
                    reviews.forEach(r => addMortgageReview(r.year, r.rate));
                } else if (data.inputs && data.inputs['futureLoanRate']) {
                    addMortgageReview(data.inputs['futureLoanRateYear'] || 10, data.inputs['futureLoanRate']);
                } else {
                    addMortgageReview(10, 2.5);
                }
            } catch (e) {
                console.error('Failed to parse mortgage reviews', e);
                addMortgageReview(10, 2.5);
            }
        } else if (data.inputs && data.inputs['futureLoanRate']) {
            // Backward compatibility
            addMortgageReview(data.inputs['futureLoanRateYear'] || 10, data.inputs['futureLoanRate']);
        } else {
            // Default if no data
            addMortgageReview(10, 2.5);
        }

        // 2. Children
        // Clear existing first
        const childContainer = $('childrenContainer');
        if (childContainer) childContainer.innerHTML = '';
        childCount = 0; // Global var reset

        if (data.children && data.children.length > 0) {
            data.children.forEach(cData => {
                addChild(cData.mode);
                // Get the last added child
                const entries = document.querySelectorAll('.child-entry');
                const lastEntry = entries[entries.length - 1];
                if (lastEntry) {
                    if (cData.mode === 'existing') {
                        const input = lastEntry.querySelector('.child-age-input');
                        if (input) input.value = cData.ageInput;
                    } else {
                        const input = lastEntry.querySelector('.child-year-input');
                        if (input) input.value = cData.yearInput;
                    }
                    // Edu
                    if (lastEntry.querySelector('.edu-k')) lastEntry.querySelector('.edu-k').value = cData.edu_k;
                    if (lastEntry.querySelector('.edu-e')) lastEntry.querySelector('.edu-e').value = cData.edu_e;
                    if (lastEntry.querySelector('.edu-j')) lastEntry.querySelector('.edu-j').value = cData.edu_j;
                    if (lastEntry.querySelector('.edu-h')) lastEntry.querySelector('.edu-h').value = cData.edu_h;
                    if (lastEntry.querySelector('.edu-u')) lastEntry.querySelector('.edu-u').value = cData.edu_u;
                    // Juku
                    const jukuToggle = lastEntry.querySelector('.juku-toggle');
                    if (jukuToggle) {
                        jukuToggle.checked = cData.juku_active;
                        toggleJuku(jukuToggle); // Handler
                    }
                    if (lastEntry.querySelector('.juku-cost')) lastEntry.querySelector('.juku-cost').value = cData.juku_cost;
                    if (lastEntry.querySelector('.juku-start')) lastEntry.querySelector('.juku-start').value = cData.juku_start;
                    if (lastEntry.querySelector('.juku-end')) lastEntry.querySelector('.juku-end').value = cData.juku_end;

                    updateChildCostSummary(); // Refresh preview
                }
            });
        }

        // 3. Custom Events
        const evtContainer = $('customEventsContainer');
        if (evtContainer) evtContainer.innerHTML = '';
        if (data.customEvents && data.customEvents.length > 0) {
            data.customEvents.forEach(evt => {
                addCustomEvent(); // Adds row
                const rows = document.querySelectorAll('.custom-event-row');
                const lastRow = rows[rows.length - 1];
                if (lastRow) {
                    lastRow.querySelector('.evt-age').value = evt.age;
                    lastRow.querySelector('.evt-type').value = evt.type;
                    lastRow.querySelector('.evt-amount').value = evt.amount;
                    lastRow.querySelector('.custom-event-name').value = evt.name;
                }
            });
        }

        // 4. Scenarios
        if (data.scenarios) {
            savedScenarios = data.scenarios;
            if (savedScenarios.length > 0) {
                savedScenarios.forEach(sc => renderScenarioBar(sc)); // Rebuild UI chips
            }
        }

        // 5. Run Calc
        setTimeout(() => {
            if (!$('resultsSection').classList.contains('hidden')) {
                const data = runSimulation();
                if (data) renderResults(data, true);
            }
        }, 200);

    } catch (e) {
        console.error('Failed to load data', e);
    }
}

function clearData() {
    if (!confirm('全てのデータを削除して初期状態に戻しますか？')) return;
    localStorage.removeItem(SAVE_KEY);
    location.reload();
}

// Ensure the helper functions are defined here as well
function addMortgageReview(year = 10, rate = 2.5) {
    const container = $('mortgageRateReviewsContainer');
    if (!container) return;
    const entry = document.createElement('div');
    entry.className = 'form-group review-entry';
    entry.style.cssText = 'position: relative; padding-right: 2rem; border: 1px solid var(--border-color); padding: 1rem; border-radius: 4px; margin-bottom: 0.5rem;';

    entry.innerHTML = `
        <button type="button" class="btn btn-small" style="position: absolute; top: 0.5rem; right: 0.5rem; background-color: #ef4444; color: white; padding: 0.2rem 0.5rem;" onclick="removeMortgageReview(this)">×</button>
        <label>想定金利（上昇後）</label>
        <div style="display:flex; gap: 1rem; flex-wrap: wrap;">
            <div style="flex:1;">
                <div class="input-with-unit">
                    <input type="number" class="futureLoanRateInput" min="0" max="10" step="0.01" value="${rate}" onchange="if(typeof autoCalculate === 'function') autoCalculate()">
                    <span class="unit">%</span>
                </div>
            </div>
            <div style="flex:1; display:flex; align-items:center; gap:0.3rem;">
                <label style="font-size:0.75rem; color:var(--text-secondary); white-space:nowrap;">上昇時期</label>
                <div class="input-with-unit" style="width:100px;">
                    <input type="number" class="futureLoanRateYearInput" min="1" max="50" value="${year}" onchange="if(typeof autoCalculate === 'function') autoCalculate()">
                    <span class="unit">年後</span>
                </div>
            </div>
        </div>
    `;

    container.appendChild(entry);
    if (typeof autoCalculate === 'function') autoCalculate();
}

function removeMortgageReview(btn) {
    const entry = btn.closest('.review-entry');
    if (entry) {
        entry.remove();
        if (typeof autoCalculate === 'function') autoCalculate();
    }
}

function getMortgageReviews() {
    const container = $('mortgageRateReviewsContainer');
    if (!container) return [];

    const reviews = [];
    const entries = container.querySelectorAll('.review-entry');

    entries.forEach(entry => {
        const rateInput = entry.querySelector('.futureLoanRateInput');
        const yearInput = entry.querySelector('.futureLoanRateYearInput');

        if (rateInput && yearInput) {
            const rate = parseFloat(rateInput.value) || 0;
            const year = parseInt(yearInput.value, 10) || 0;
            if (year > 0) {
                reviews.push({ year, rate });
            }
        }
    });

    return reviews.sort((a, b) => a.year - b.year);
}

function clearMortgageReviews() {
    const container = $('mortgageRateReviewsContainer');
    if (container) {
        container.innerHTML = '';
    }
}

// Attach Auto-Save
document.addEventListener('DOMContentLoaded', () => {
    // Load first
    loadData();

    // Show net income preview on load
    updateNetIncomePreview();

    // Attach listeners
    const form = document.getElementById('planForm');
    if (form) {
        // Debounced save
        form.addEventListener('input', debounce(saveData, 1000));
        form.addEventListener('change', saveData);
    }
    // Also save on scenario add
    const addScenBtn = document.getElementById('addScenarioBtn');
    if (addScenBtn) {
        addScenBtn.addEventListener('click', () => setTimeout(saveData, 500));
    }
});

// --- Usage Guide Video Logic ---
function openUsageGuide() {
    const modal = document.getElementById('usageGuideModal');
    if (modal) {
        modal.classList.remove('hidden');
        // Close on clicking outside content
        modal.addEventListener('click', function closeOnBg(e) {
            if (e.target === modal) {
                closeUsageGuide();
                modal.removeEventListener('click', closeOnBg);
            }
        });
    }
}

function closeUsageGuide() {
    const modal = document.getElementById('usageGuideModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// --- About Modal Logic ---
function openAbout() {
    const modal = document.getElementById('aboutModal');
    if (modal) {
        modal.classList.remove('hidden');
        // Close on clicking outside content
        modal.addEventListener('click', function closeOnBg(e) {
            if (e.target === modal) {
                closeAbout();
                modal.removeEventListener('click', closeOnBg);
            }
        });
    }
}

function closeAbout() {
    const modal = document.getElementById('aboutModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

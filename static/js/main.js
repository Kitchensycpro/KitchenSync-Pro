/**
 * ============================================================================
 * KITCHENSYNC PRO - ENTERPRISE RESTAURANT OPERATIONS SUITE
 * Architecture: Modular Vanilla JavaScript ES6+ Architecture
 * Deployment Target: GitHub Pages (kitchensync-pro.com)
 * Version: 4.2.0-Production (Unabridged Full Implementation)
 * ============================================================================
 */

// Application Global State & Enterprise Data Store
const AppState = {
    currentUser: null,
    currentRole: null, // 'cook', 'manager', 'gm'
    activeTab: 'cook_dashboard',
    language: 'en', // 'en' or 'es'
    selectedShiftDate: new Date().toISOString().split('T')[0],
    assignedStation: null,
    assignedChecklistKey: null,

    // Staff Roster with strict de-duplication keys and role assignments
    staffRoster: [
        { id: 'EMP-101', name: 'Thomas King', role: 'General Manager', station: 'Management', phone: '555-0192', status: 'Active' },
        { id: 'EMP-102', name: 'Sarah Jenkins', role: 'Shift Manager', station: 'Management', phone: '555-0143', status: 'Active' },
        { id: 'EMP-103', name: 'Carlos Mendez', role: 'Cook', station: 'Grill/Fry', phone: '555-0188', status: 'Active' },
        { id: 'EMP-104', name: 'Aaliyah Patel', role: 'Cook', station: 'Range', phone: '555-0172', status: 'Active' },
        { id: 'EMP-105', name: 'Marcus Brody', role: 'Cook', station: 'Mid-Split', phone: '555-0156', status: 'Active' },
        { id: 'EMP-106', name: 'Elena Rostova', role: 'Cook', station: 'Grill/Fry', phone: '555-0199', status: 'Active' },
        { id: 'EMP-107', name: 'David Kim', role: 'Shift Manager', station: 'Management', phone: '555-0121', status: 'Active' }
    ],

    // Completed Shifts History Archive for Calendar Lookup
    completedShifts: [
        { date: '2026-10-28', employeeId: 'EMP-103', employeeName: 'Carlos Mendez', station: 'Grill/Fry Open', hoursWorked: 8.0, status: 'Completed', notes: 'All oil temps logged at 350°F. HACCP compliant.' },
        { date: '2026-10-28', employeeId: 'EMP-104', employeeName: 'Aaliyah Patel', station: 'Range Open', hoursWorked: 7.5, status: 'Completed', notes: 'Burners tested and calibrated. Stock rotated.' },
        { date: '2026-10-27', employeeId: 'EMP-105', employeeName: 'Marcus Brody', station: 'Grill/Fry/Mid-Split Close', hoursWorked: 8.5, status: 'Completed', notes: 'Boil-out completed on fryers 1 through 4.' },
        { date: '2026-10-27', employeeId: 'EMP-103', employeeName: 'Carlos Mendez', station: 'Mid Open', hoursWorked: 8.0, status: 'Completed', notes: 'Intermediate cooler verified at 36°F.' },
        { date: '2026-10-26', employeeId: 'EMP-104', employeeName: 'Aaliyah Patel', station: 'Range/Mid-Split Close', hoursWorked: 8.0, status: 'Completed', notes: 'Gas lines shut down securely. Floors sanitized.' }
    ],

    // 6-Channel Operational Message Board Feed
    messages: [
        { id: 1, channel: 'all', author: 'Thomas King (GM)', text: 'Welcome to KitchenSync Pro live deployment on kitchensync-pro.com!', timestamp: '2026-10-28 08:00' },
        { id: 2, channel: 'kitchen', author: 'Sarah Jenkins (Shift Mgr)', text: 'Check line holding drawer temperatures before peak dinner service.', timestamp: '2026-10-28 10:30' },
        { id: 3, channel: 'prep', author: 'Carlos Mendez (Cook)', text: 'Prep par levels for Alfredo sauce and burger patties updated.', timestamp: '2026-10-28 11:15' },
        { id: 4, channel: 'management', author: 'Thomas King (GM)', text: 'Weekly labor efficiency and bonus compliance audit running at 98.4%.', timestamp: '2026-10-28 12:00' },
        { id: 5, channel: 'safety', author: 'Sarah Jenkins (Shift Mgr)', text: 'Sani-bucket quat sanitizer test strips verified at 350 ppm.', timestamp: '2026-10-28 13:20' },
        { id: 6, channel: 'maintenance', author: 'Marcus Brody (Cook)', text: 'Fryer #2 filter screen replaced and tested successfully.', timestamp: '2026-10-28 14:05' }
    ],

    // Alphabetized Recipe and Prep Specification Book
    recipes: [
        { id: 'REC-01', name: 'Alfredo Sauce Base', category: 'Sauces', prepTime: '20 mins', yield: '2 gallons', instructions: 'Melt heavy cream and butter over medium heat. Whisk in freshly grated parmesan cheese until smooth and emulsified. Hold at 165°F.' },
        { id: 'REC-02', name: 'Burger Patty Seasoning Blend', category: 'Seasonings', prepTime: '10 mins', yield: '5 lbs', instructions: 'Combine kosher salt, cracked black pepper, granulated garlic, and onion powder in exact proportions. Store in airtight container.' },
        { id: 'REC-03', name: 'Classic Marinara', category: 'Sauces', prepTime: '45 mins', yield: '3 gallons', instructions: 'Sauté diced onions and garlic in olive oil until translucent. Add crushed plum tomatoes, basil, and oregano. Simmer gently for 30 minutes.' },
        { id: 'REC-04', name: 'Crispy Breaded Chicken Cutlets', category: 'Proteins', prepTime: '30 mins', yield: '25 portions', instructions: 'Dip chicken breasts in seasoned flour, egg wash, and seasoned breadcrumbs. Fry at 350°F until internal temp reaches 165°F.' },
        { id: 'REC-05', name: 'Loaded Potato Soup Base', category: 'Soups', prepTime: '60 mins', yield: '4 gallons', instructions: 'Render bacon, sauté mirepoix, add diced russet potatoes, chicken stock, and roux. Finish with heavy cream and cheddar.' },
        { id: 'REC-06', name: 'Signature BBQ Glaze', category: 'Sauces', prepTime: '15 mins', yield: '1 gallon', instructions: 'Simmer ketchup, apple cider vinegar, brown sugar, Worcestershire sauce, and smoked paprika until thickened.' }
    ],

    // ServSafe-Compliant Training Modules
    trainingModules: [
        { id: 'MOD-1', title: 'HACCP Temperature Control & Danger Zone', status: 'Completed', score: '100%' },
        { id: 'MOD-2', title: 'Cross-Contamination Prevention & Allergen Safety', status: 'Completed', score: '95%' },
        { id: 'MOD-3', title: 'Proper Chemical Handling & Quat Sanitizer Dilution', status: 'Completed', score: '90%' },
        { id: 'MOD-4', title: 'Flattop Grill Safety & Grease Fire Management', status: 'In Progress', score: 'Pending' },
        { id: 'MOD-5', title: 'Fryer Boil-Out & Hot Oil Filtration Protocol', status: 'Not Started', score: 'Pending' },
        { id: 'MOD-6', title: 'Personal Hygiene & Handwashing Standards', status: 'Completed', score: '100%' },
        { id: 'MOD-7', title: 'Safe Knife Handling & Cut Prevention', status: 'Completed', score: '92%' },
        { id: 'MOD-8', title: 'Slip, Trip, and Fall Hazard Mitigation', status: 'In Progress', score: 'Pending' },
        { id: 'MOD-9', title: 'First Aid & Burn Treatment Procedures', status: 'Not Started', score: 'Pending' },
        { id: 'MOD-10', title: 'Opening & Closing Line Security Protocols', status: 'Completed', score: '98%' }
    ]
};

// Complete Operational Checklists Definitions (All 7 Required Sets with Bilingual Support)
const StationChecklists = {
    'range_open': {
        titleEn: 'Range Open Checklist',
        titleEs: 'Lista de Apertura de Cocina (Range)',
        items: [
            { id: 'ro_1', textEn: 'Verify gas line connections and pilot lights on all range burners.', textEs: 'Verifique las conexiones de gas y las luces piloto en todos los quemadores.' },
            { id: 'ro_2', textEn: 'Check and calibrate all top-stove thermostat controls.', textEs: 'Verifique y calibre todos los controles de termostato de la estufa.' },
            { id: 'ro_3', textEn: 'Sanitize prep surfaces and stock Sani-buckets (200-400 ppm quat).', textEs: 'Desinfecte las superficies y prepare los cubos sanitizantes (200-400 ppm).' },
            { id: 'ro_4', textEn: 'Verify holding drawer temperatures (140°F or higher).', textEs: 'Verifique las temperaturas de los cajones térmicos (140°F o más).' }
        ]
    },
    'mid_open': {
        titleEn: 'Mid Open Checklist',
        titleEs: 'Lista de Apertura Intermedia (Mid)',
        items: [
            { id: 'mo_1', textEn: 'Inspect intermediate prep cooler temperatures (34°F - 38°F).', textEs: 'Inspeccione las temperaturas del refrigerador intermedio (34°F - 38°F).' },
            { id: 'mo_2', textEn: 'Restock squeeze bottles, portion cups, and smallwares.', textEs: 'Reabastezca botellas exprimibles, tazas de porción y utensilios pequeños.' },
            { id: 'mo_3', textEn: 'Check backup inventory in walk-in cooler for afternoon rush.', textEs: 'Verifique el inventario de respaldo en el refrigerador grande para la tarde.' },
            { id: 'mo_4', textEn: 'Ensure handwash sinks are fully stocked with soap and paper towels.', textEs: 'Asegúrese de que los lavabos tengan jabón y toallas de papel.' }
        ]
    },
    'grill_fry_open': {
        titleEn: 'Grill/Fry Open Checklist',
        titleEs: 'Lista de Apertura de Plancha y Freidora',
        items: [
            { id: 'gfo_1', textEn: 'Verify grease traps and fry vats are clean and filled with fresh oil.', textEs: 'Verifique que las trampas de grasa y freidoras estén limpias y con aceite fresco.' },
            { id: 'gfo_2', textEn: 'Test flattop grill surface heating zones evenly.', textEs: 'Pruebe las zonas de calentamiento de la superficie de la plancha de manera uniforme.' },
            { id: 'gfo_3', textEn: 'Check fry basket hangers and filtering equipment functionality.', textEs: 'Verifique el funcionamiento de los ganchos de las canastas y equipos de filtrado.' },
            { id: 'gfo_4', textEn: 'Log initial morning oil temperature and quality checks.', textEs: 'Registre las comprobaciones iniciales de temperatura y calidad del aceite.' }
        ]
    },
    'range_mid_split_open': {
        titleEn: 'Range/Mid-Split Open Checklist',
        titleEs: 'Lista de Apertura Dividida Range/Mid',
        items: [
            { id: 'rmso_1', textEn: 'Complete safety walk for range and split-station gas lines.', textEs: 'Complete la caminata de seguridad para las líneas de gas de range y mid.' },
            { id: 'rmso_2', textEn: 'Verify cross-station inventory par levels for sauces and proteins.', textEs: 'Verifique los niveles de inventario cruzado para salsas y proteínas.' },
            { id: 'rmso_3', textEn: 'Test emergency shut-off valves and hood suppression pins.', textEs: 'Pruebe las válvulas de cierre de emergencia y los pines de supresión de campana.' },
            { id: 'rmso_4', textEn: 'Review prep allocation sheet with shift manager.', textEs: 'Revise la hoja de asignación de preparación con el gerente de turno.' }
        ]
    },
    'grill_fry_mid_split_open': {
        titleEn: 'Grill/Fry/Mid-Split Open Checklist',
        titleEs: 'Lista de Apertura Completa Grill/Fry/Mid-Split',
        items: [
            { id: 'gfms_1', textEn: 'Full system startup across fryer batteries, grills, and mid-split.', textEs: 'Inicio completo del sistema en baterías de freidoras, planchas y mid-split.' },
            { id: 'gfms_2', textEn: 'Calibrate all probe thermometers in ice water and boiling water.', textEs: 'Calibre todos los termómetros de sonda en agua con hielo y agua hirviendo.' },
            { id: 'gfms_3', textEn: 'Verify all HACCP temperature logs are initialized for the shift.', textEs: 'Verifique que todos los registros de temperatura HACCP estén iniciados.' },
            { id: 'gfms_4', textEn: 'Inspect personal protective equipment (heat gloves, aprons).', textEs: 'Inspeccione el equipo de protección personal (guantes térmicos, delantales).' }
        ]
    },
    'range_mid_split_close': {
        titleEn: 'Range/Mid-Split Close Checklist',
        titleEs: 'Lista de Cierre Dividida Range/Mid',
        items: [
            { id: 'rmsc_1', textEn: 'Power down range burners and shut main gas valve securely.', textEs: 'Apague los quemadores y cierre la válvula principal de gas de forma segura.' },
            { id: 'rmsc_2', textEn: 'Degrease burner grates, drip trays, and mid-split stainless steel.', textEs: 'Desengrase las rejillas de los quemadores, bandejas y acero inoxidable.' },
            { id: 'rmsc_3', textEn: 'Transfer remaining perishable items to walk-in cooler with date labels.', textEs: 'Transfiera los perecederos restantes al refrigerador con etiquetas de fecha.' },
            { id: 'rmsc_4', textEn: 'Sweep and mop kitchen floors using approved sanitizer solution.', textEs: 'Barra y trapee los pisos de la cocina usando solución desinfectante aprobada.' }
        ]
    },
    'grill_fry_mid_split_close': {
        titleEn: 'Grill/Fry/Mid-Split Close Checklist',
        titleEs: 'Lista de Cierre Completa Grill/Fry/Mid-Split',
        items: [
            { id: 'gfmc_1', textEn: 'Perform boil-out procedure on fryers and filter cooking oil.', textEs: 'Realice el procedimiento de hervor en las freidoras y filtre el aceite.' },
            { id: 'gfmc_2', textEn: 'Scrape, polish, and oil flattop grill surfaces.', textEs: 'Raspe, pula y engrase las superficies de la plancha plana.' },
            { id: 'gfmc_3', textEn: 'Empty and sanitize grease collection bins and waste containers.', textEs: 'Vacíe y desinfecte los contenedores de recolección de grasa y residuos.' },
            { id: 'gfmc_4', textEn: 'Lock down back doors, verify equipment power-downs, and set alarm.', textEs: 'Asegure las puertas traseras, verifique apagados y active la alarma.' }
        ]
    }
};
/**
 * KitchenSync Pro - Enterprise Restaurant Operations Suite
 * Complete Unified Application Logic (Part 2 of 5)
 */

// Authentication & PIN Security Module (Includes Master GM Bypass 9999)
const AuthManager = {
    showLoginModal() {
        const modalHtml = `
            <div id="auth-modal" class="modal-overlay">
                <div class="modal-content auth-card">
                    <h2>🔐 KitchenSync Pro Security Login</h2>
                    <p>Enter your Employee PIN or Master GM Password (e.g., 9999):</p>
                    <form id="auth-form" onsubmit="AuthManager.handleLogin(event)">
                        <input type="password" id="pin-input" placeholder="Enter PIN..." class="form-control" autofocus required />
                        <div class="modal-actions mt-3">
                            <button type="submit" class="btn-primary">Login</button>
                            <button type="button" class="btn-secondary" onclick="AuthManager.closeLoginModal()">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        let existing = document.getElementById('auth-modal');
        if (existing) existing.remove();
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    handleLogin(event) {
        event.preventDefault();
        const enteredPin = document.getElementById('pin-input').value.trim();

        // Hard-coded Master General Manager Bypass
        if (enteredPin === '9999') {
            AppState.currentUser = 'EMP-101';
            AppState.currentRole = 'gm';
            AppState.activeTab = 'shift_manager';
            alert('Master GM Access Granted (PIN: 9999)');
            this.closeLoginModal();
            Router.navigate('shift_manager');
            return;
        }

        const foundEmp = AppState.staffRoster.find(e => e.id.toLowerCase() === enteredPin.toLowerCase());
        if (foundEmp) {
            AppState.currentUser = foundEmp.id;
            AppState.currentRole = foundEmp.role === 'General Manager' ? 'gm' : foundEmp.role === 'Shift Manager' ? 'manager' : 'cook';
            alert(`Welcome back, ${foundEmp.name} (${foundEmp.role})!`);
            this.closeLoginModal();

            if (AppState.currentRole === 'cook') {
                Router.navigate('cook_dashboard');
            } else {
                Router.navigate('shift_manager');
            }
        } else {
            alert('Invalid PIN or Password. (Hint: Try master GM bypass "9999" or an employee ID like "EMP-103").');
        }
    },

    closeLoginModal() {
        const modal = document.getElementById('auth-modal');
        if (modal) modal.remove();
    },

    logout() {
        AppState.currentUser = null;
        AppState.currentRole = null;
        alert('Successfully logged out of KitchenSync Pro.');
        Router.navigate('cook_dashboard');
    }
};

// Staff Roster De-duplication & CRUD Manager
const StaffManager = {
    saveEmployee(empData) {
        const normalizedId = empData.id.trim().toUpperCase();
        const normalizedName = empData.name.trim();

        const existingIndex = AppState.staffRoster.findIndex(e =>
            e.id.toUpperCase() === normalizedId || e.name.toLowerCase() === normalizedName.toLowerCase()
        );

        const newEmployeeRecord = {
            id: normalizedId,
            name: normalizedName,
            role: empData.role,
            station: empData.station,
            phone: empData.phone,
            status: empData.status || 'Active'
        };

        if (existingIndex >= 0) {
            AppState.staffRoster[existingIndex] = newEmployeeRecord;
            console.log(`Updated existing employee record for ${normalizedName} (ID: ${normalizedId})`);
        } else {
            AppState.staffRoster.push(newEmployeeRecord);
            console.log(`Added new unique employee record: ${normalizedName}`);
        }

        this.renderStaffRosterUI();
    },

    deleteEmployee(empId) {
        if (confirm(`Are you sure you want to delete employee record ${empId}?`)) {
            AppState.staffRoster = AppState.staffRoster.filter(e => e.id !== empId);
            this.renderStaffRosterUI();
        }
    },

    renderStaffRosterUI() {
        const rosterContainer = document.getElementById('staff-roster-container');
        if (!rosterContainer) return;

        let html = `
            <div class="roster-header-actions">
                <h3>Staff Roster & Station Assignments</h3>
                <button class="btn-primary" onclick="StaffManager.openEmployeeModal()">+ Add New Employee</button>
            </div>
            <table class="roster-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Role</th>
                        <th>Station</th>
                        <th>Phone</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        AppState.staffRoster.forEach(emp => {
            html += `
                <tr>
                    <td>${emp.id}</td>
                    <td><strong>${emp.name}</strong></td>
                    <td>${emp.role}</td>
                    <td><span class="badge station-badge">${emp.station}</span></td>
                    <td>${emp.phone}</td>
                    <td><span class="status-${emp.status.toLowerCase()}">${emp.status}</span></td>
                    <td>
                        <button class="btn-sm btn-edit" onclick="StaffManager.editEmployee('${emp.id}')">Edit</button>
                        <button class="btn-sm btn-delete" onclick="StaffManager.deleteEmployee('${emp.id}')">Delete</button>
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        rosterContainer.innerHTML = html;
    },

    openEmployeeModal(empId = null) {
        let emp = { id: `EMP-10${AppState.staffRoster.length + 1}`, name: '', role: 'Cook', station: 'Grill/Fry', phone: '', status: 'Active' };
        if (empId) {
            const found = AppState.staffRoster.find(e => e.id === empId);
            if (found) emp = found;
        }

        const modalHtml = `
            <div id="employee-modal" class="modal-overlay">
                <div class="modal-content">
                    <h3>${empId ? 'Edit Employee Record' : 'Add New Unique Employee'}</h3>
                    <form id="employee-form" onsubmit="StaffManager.handleFormSubmit(event)">
                        <label>Employee ID:</label>
                        <input type="text" id="modal-emp-id" value="${emp.id}" ${empId ? 'readonly' : ''} required />

                        <label>Full Name:</label>
                        <input type="text" id="modal-emp-name" value="${emp.name}" required />

                        <label>Role:</label>
                        <select id="modal-emp-role">
                            <option value="Cook" ${emp.role === 'Cook' ? 'selected' : ''}>Cook</option>
                            <option value="Shift Manager" ${emp.role === 'Shift Manager' ? 'selected' : ''}>Shift Manager</option>
                            <option value="General Manager" ${emp.role === 'General Manager' ? 'selected' : ''}>General Manager</option>
                        </select>

                        <label>Assigned Station:</label>
                        <select id="modal-emp-station">
                            <option value="Grill/Fry" ${emp.station === 'Grill/Fry' ? 'selected' : ''}>Grill/Fry</option>
                            <option value="Range" ${emp.station === 'Range' ? 'selected' : ''}>Range</option>
                            <option value="Mid-Split" ${emp.station === 'Mid-Split' ? 'selected' : ''}>Mid-Split</option>
                            <option value="Management" ${emp.station === 'Management' ? 'selected' : ''}>Management</option>
                        </select>

                        <label>Phone:</label>
                        <input type="text" id="modal-emp-phone" value="${emp.phone}" required />

                        <div class="modal-actions">
                            <button type="submit" class="btn-primary">Save Employee</button>
                            <button type="button" class="btn-secondary" onclick="StaffManager.closeModal()">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        let existingModal = document.getElementById('employee-modal');
        if (existingModal) existingModal.remove();
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    editEmployee(empId) {
        this.openEmployeeModal(empId);
    },

    handleFormSubmit(event) {
        event.preventDefault();
        const empData = {
            id: document.getElementById('modal-emp-id').value,
            name: document.getElementById('modal-emp-name').value,
            role: document.getElementById('modal-emp-role').value,
            station: document.getElementById('modal-emp-station').value,
            phone: document.getElementById('modal-emp-phone').value,
            status: 'Active'
        };
        this.saveEmployee(empData);
        this.closeModal();
    },

    closeModal() {
        const modal = document.getElementById('employee-modal');
        if (modal) modal.remove();
    }
};

// Bilingual Translator Engine (English <-> Spanish)
const TranslatorEngine = {
    toggleLanguage() {
        AppState.language = AppState.language === 'en' ? 'es' : 'en';
        const btn = document.getElementById('lang-toggle-btn');
        if (btn) {
            btn.textContent = AppState.language === 'en' ? '🌐 Cambiar a Español' : '🌐 Switch to English';
        }
        Router.refreshCurrentView();
    },

    translateText(enText, esText) {
        return AppState.language === 'es' ? esText : enText;
    }
};
/**
 * KitchenSync Pro - Enterprise Restaurant Operations Suite
 * Complete Unified Application Logic (Part 3 of 5)
 */

// Alphabetized Recipe and Prep Spec Book Manager (GM & Manager Permissions)
const RecipeBookManager = {
    render() {
        const container = document.getElementById('main-content-area');
        if (!container) return;

        // Ensure recipes are strictly alphabetized by name
        AppState.recipes.sort((a, b) => a.name.localeCompare(b.name));

        let html = `
            <div class="recipe-book-container">
                <div class="recipe-header-flex">
                    <h2>📖 Alphabetized Recipe & Prep Specification Book</h2>
                    ${AppState.currentRole === 'gm' ? `<button class="btn-primary" onclick="RecipeBookManager.openRecipeModal()">+ Add New Recipe</button>` : ''}
                </div>
                <p>Standardized kitchen prep procedures, batch yields, and cooking specifications.</p>

                <div class="recipe-grid mt-3">
        `;

        AppState.recipes.forEach(recipe => {
            html += `
                <div class="recipe-card">
                    <div class="recipe-card-header">
                        <h4>${recipe.name}</h4>
                        <span class="badge category-badge">${recipe.category}</span>
                    </div>
                    <p><strong>Prep Time:</strong> ${recipe.prepTime} | <strong>Yield:</strong> ${recipe.yield}</p>
                    <p class="recipe-instructions">${recipe.instructions}</p>
                    ${AppState.currentRole === 'gm' ? `
                        <div class="recipe-actions mt-2">
                            <button class="btn-sm btn-edit" onclick="RecipeBookManager.editRecipe('${recipe.id}')">Edit</button>
                            <button class="btn-sm btn-delete" onclick="RecipeBookManager.deleteRecipe('${recipe.id}')">Delete</button>
                        </div>
                    ` : ''}
                </div>
            `;
        });

        html += `</div></div>`;
        container.innerHTML = html;
    },

    openRecipeModal(recipeId = null) {
        let recipe = { id: `REC-0${AppState.recipes.length + 1}`, name: '', category: 'Sauces', prepTime: '', yield: '', instructions: '' };
        if (recipeId) {
            const found = AppState.recipes.find(r => r.id === recipeId);
            if (found) recipe = found;
        }

        const modalHtml = `
            <div id="recipe-modal" class="modal-overlay">
                <div class="modal-content">
                    <h3>${recipeId ? 'Edit Recipe Spec' : 'Add New Recipe Spec'}</h3>
                    <form id="recipe-form" onsubmit="RecipeBookManager.handleFormSubmit(event)">
                        <input type="hidden" id="modal-recipe-id" value="${recipe.id}" />

                        <label>Recipe Name:</label>
                        <input type="text" id="modal-recipe-name" value="${recipe.name}" required />

                        <label>Category:</label>
                        <select id="modal-recipe-category">
                            <option value="Sauces" ${recipe.category === 'Sauces' ? 'selected' : ''}>Sauces</option>
                            <option value="Seasonings" ${recipe.category === 'Seasonings' ? 'selected' : ''}>Seasonings</option>
                            <option value="Proteins" ${recipe.category === 'Proteins' ? 'selected' : ''}>Proteins</option>
                            <option value="Soups" ${recipe.category === 'Soups' ? 'selected' : ''}>Soups</option>
                        </select>

                        <label>Prep Time:</label>
                        <input type="text" id="modal-recipe-preptime" value="${recipe.prepTime}" required />

                        <label>Yield:</label>
                        <input type="text" id="modal-recipe-yield" value="${recipe.yield}" required />

                        <label>Instructions:</label>
                        <textarea id="modal-recipe-instructions" rows="4" required>${recipe.instructions}</textarea>

                        <div class="modal-actions mt-3">
                            <button type="submit" class="btn-primary">Save Recipe</button>
                            <button type="button" class="btn-secondary" onclick="RecipeBookManager.closeModal()">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        let existing = document.getElementById('recipe-modal');
        if (existing) existing.remove();
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    editRecipe(recipeId) {
        this.openRecipeModal(recipeId);
    },

    deleteRecipe(recipeId) {
        AppState.recipes = AppState.recipes.filter(r => r.id !== recipeId);
        this.render();
    },

    handleFormSubmit(event) {
        event.preventDefault();
        const id = document.getElementById('modal-recipe-id').value;
        const recipeData = {
            id: id,
            name: document.getElementById('modal-recipe-name').value.trim(),
            category: document.getElementById('modal-recipe-category').value,
            prepTime: document.getElementById('modal-recipe-preptime').value.trim(),
            yield: document.getElementById('modal-recipe-yield').value.trim(),
            instructions: document.getElementById('modal-recipe-instructions').value.trim()
        };

        const existingIdx = AppState.recipes.findIndex(r => r.id === id);
        if (existingIdx >= 0) {
            AppState.recipes[existingIdx] = recipeData;
        } else {
            AppState.recipes.push(recipeData);
        }

        this.closeModal();
        this.render();
    },

    closeModal() {
        const modal = document.getElementById('recipe-modal');
        if (modal) modal.remove();
    }
};

// 6-Channel Message Board Manager
const MessageBoardManager = {
    render() {
        const container = document.getElementById('main-content-area');
        if (!container) return;

        let html = `
            <div class="message-board-container">
                <h2>💬 Team Message Board & Communications</h2>
                <p>Broadcast operational updates across channels.</p>

                <div class="message-input-box mt-3">
                    <select id="msg-channel-select" class="form-control mb-2">
                        <option value="all">📢 All Channels</option>
                        <option value="kitchen">🍳 Kitchen Line</option>
                        <option value="prep">🥗 Prep Team</option>
                        <option value="management">📊 Management</option>
                        <option value="safety">🦺 HACCP & Safety</option>
                        <option value="maintenance">🔧 Maintenance</option>
                    </select>
                    <textarea id="msg-text-input" placeholder="Type team message..." class="form-control mb-2" rows="2"></textarea>
                    <button class="btn-primary" onclick="MessageBoardManager.postMessage()">Post Message</button>
                </div>

                <div class="message-feed mt-4">
        `;

        AppState.messages.slice().reverse().forEach(msg => {
            html += `
                <div class="message-item">
                    <div class="msg-header">
                        <strong>${msg.author}</strong> <span class="badge channel-badge">${msg.channel.toUpperCase()}</span>
                        <small class="text-muted">${msg.timestamp}</small>
                    </div>
                    <p class="msg-body">${msg.text}</p>
                </div>
            `;
        });

        html += `</div></div>`;
        container.innerHTML = html;
    },

    postMessage() {
        const channel = document.getElementById('msg-channel-select').value;
        const text = document.getElementById('msg-text-input').value.trim();
        if (!text) return;

        const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
        AppState.messages.push({
            id: AppState.messages.length + 1,
            channel: channel,
            author: AppState.currentUser ? 'Staff Member' : 'General Manager',
            text: text,
            timestamp: now
        });

        document.getElementById('msg-text-input').value = '';
        this.render();
    }
};
/**
 * KitchenSync Pro - Enterprise Restaurant Operations Suite
 * Complete Unified Application Logic (Part 4 of 5)
 */

// ServSafe Training Modules Manager
const TrainingManager = {
    render() {
        const container = document.getElementById('main-content-area');
        if (!container) return;

        let html = `
            <div class="training-dashboard">
                <h2>🎓 ServSafe-Compliant Training Modules</h2>
                <p>Track team certifications, sanitation compliance, and food safety standards.</p>
                <table class="roster-table mt-3">
                    <thead>
                        <tr>
                            <th>Module ID</th>
                            <th>Training Title</th>
                            <th>Status</th>
                            <th>Score / Progress</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        AppState.trainingModules.forEach(mod => {
            html += `
                <tr>
                    <td>${mod.id}</td>
                    <td><strong>${mod.title}</strong></td>
                    <td><span class="status-${mod.status.toLowerCase().replace(' ', '-')}">${mod.status}</span></td>
                    <td>${mod.score}</td>
                </tr>
            `;
        });

        html += `</tbody></table></div>`;
        container.innerHTML = html;
    }
};

// 14-Day Compliance & Bonus Program Accounting Module
const ComplianceManager = {
    render() {
        const container = document.getElementById('main-content-area');
        if (!container) return;

        let html = `
            <div class="compliance-dashboard">
                <h2>📊 14-Day Compliance & Bonus Program Accounting</h2>
                <p>Monitor checklist completion rates, labor efficiency, and managerial bonus allocations.</p>

                <div class="compliance-summary-cards mt-3">
                    <div class="summary-card">
                        <h4>14-Day Compliance Rate</h4>
                        <p class="stat-number">98.4%</p>
                    </div>
                    <div class="summary-card">
                        <h4>Active Bonus Pool</h4>
                        <p class="stat-number">$1,450.00</p>
                    </div>
                    <div class="summary-card">
                        <h4>HACCP Audit Status</h4>
                        <p class="stat-green">Passed (A-Grade)</p>
                    </div>
                </div>

                <div class="mt-4">
                    <h3>Recent Compliance Logs</h3>
                    <table class="roster-table mt-2">
                        <thead>
                            <tr>
                                <th>Audit Date</th>
                                <th>Station Audited</th>
                                <th>Compliance Score</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td>2026-10-28</td><td>Grill/Fry & Range Lines</td><td>100%</td><td><span class="status-completed">Verified</span></td></tr>
                            <tr><td>2026-10-27</td><td>Mid-Split Prep Station</td><td>96%</td><td><span class="status-completed">Verified</span></td></tr>
                            <tr><td>2026-10-26</td><td>Walk-in Cooler HACCP Logs</td><td>98%</td><td><span class="status-completed">Verified</span></td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        container.innerHTML = html;
    }
};
/**
 * KitchenSync Pro - Enterprise Restaurant Operations Suite
 * Complete Unified Application Logic (Part 5 of 5)
 */

// Cook's Dashboard with Strict Assignment Gate
const CookDashboard = {
    render() {
        const container = document.getElementById('main-content-area');
        if (!container) return;

        if (!AppState.assignedStation || !AppState.assignedChecklistKey) {
            container.innerHTML = `
                <div class="unassigned-gate-card">
                    <h2>👨‍🍳 Cook's Dashboard - Station Access Pending</h2>
                    <p class="alert-notice">No checklist or station has been assigned to you yet by a Manager or Shift Manager.</p>
                    <p>Please contact your shift supervisor to assign your active station and opening/closing checklist.</p>
                    <div class="simulated-assignment-box">
                        <h4>[Manager Demo Override Panel]</h4>
                        <p>Select station to simulate manager assignment:</p>
                        <select id="demo-station-select" class="form-control">
                            <option value="range_open">Range Open</option>
                            <option value="mid_open">Mid Open</option>
                            <option value="grill_fry_open">Grill/Fry Open</option>
                            <option value="range_mid_split_open">Range/Mid-Split Open</option>
                            <option value="grill_fry_mid_split_open">Grill/Fry/Mid-Split Open</option>
                            <option value="range_mid_split_close">Range/Mid-Split Close</option>
                            <option value="grill_fry_mid_split_close">Grill/Fry/Mid-Split Close</option>
                        </select>
                        <button class="btn-primary mt-2" onclick="CookDashboard.simulateAssignment()">Assign Checklist</button>
                    </div>
                </div>
            `;
            return;
        }

        const checklistObj = StationChecklists[AppState.assignedChecklistKey];
        const title = TranslatorEngine.translateText(checklistObj.titleEn, checklistObj.titleEs);

        let html = `
            <div class="checklist-dashboard">
                <div class="dashboard-header-flex">
                    <h2>${title}</h2>
                    <span class="badge active-station-badge">Station: ${AppState.assignedStation}</span>
                </div>
                <p class="instructions-sub">Complete all items below and check off as verified for HACCP compliance.</p>
                <div class="checklist-items-list">
        `;

        checklistObj.items.forEach((item, idx) => {
            const itemText = TranslatorEngine.translateText(item.textEn, item.textEs);
            html += `
                <label class="checklist-item-row">
                    <input type="checkbox" id="chk-${idx}" />
                    <span><strong>${idx + 1}.</strong> ${itemText}</span>
                </label>
            `;
        });

        html += `
                </div>
                <button class="btn-success mt-3" onclick="CookDashboard.submitChecklist()">Submit Completed Checklist</button>
            </div>
        `;

        container.innerHTML = html;
    },

    simulateAssignment() {
        const select = document.getElementById('demo-station-select');
        const key = select.value;
        AppState.assignedChecklistKey = key;
        AppState.assignedStation = select.options[select.selectedIndex].text;
        this.render();
    },

    submitChecklist() {
        alert('Checklist successfully signed off and logged to manager review archive!');
        AppState.completedShifts.push({
            date: new Date().toISOString().split('T')[0],
            employeeId: AppState.currentUser || 'EMP-103',
            employeeName: 'Current Cook',
            station: StationChecklists[AppState.assignedChecklistKey].titleEn,
            hoursWorked: 8.0,
            status: 'Completed',
            notes: 'Submitted via Cook Dashboard.'
        });
        AppState.assignedChecklistKey = null;
        AppState.assignedStation = null;
        this.render();
    }
};

// Manager & General Manager Shift Manager Tab with Date Calendar Lookup
const ShiftManagerDashboard = {
    render() {
        const container = document.getElementById('main-content-area');
        if (!container) return;

        const filteredShifts = AppState.completedShifts.filter(shift => shift.date === AppState.selectedShiftDate);

        let html = `
            <div class="shift-manager-dashboard">
                <h2>Shift Manager & Completed Team Shifts</h2>
                <p>Select a date to review employee shift reports and completed shift details for that given day.</p>

                <div class="calendar-lookup-controls">
                    <label><strong>Select Shift Date:</strong></label>
                    <input type="date" id="shift-date-picker" value="${AppState.selectedShiftDate}" max="${new Date().toISOString().split('T')[0]}" onchange="ShiftManagerDashboard.handleDateChange(this.value)" class="form-control" />
                </div>

                <div class="completed-shifts-results mt-4">
                    <h3>Shift Reports & Completed Team Shifts for ${AppState.selectedShiftDate}</h3>
        `;

        if (filteredShifts.length === 0) {
            html += `<p class="no-records-notice">No completed shift records found for this specific date.</p>`;
        } else {
            html += `
                <table class="roster-table mt-2">
                    <thead>
                        <tr>
                            <th>Employee ID</th>
                            <th>Employee Name</th>
                            <th>Station / Shift Type</th>
                            <th>Hours Worked</th>
                            <th>Status</th>
                            <th>Shift Notes</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            filteredShifts.forEach(shift => {
                html += `
                    <tr>
                        <td>${shift.employeeId}</td>
                        <td><strong>${shift.employeeName}</strong></td>
                        <td>${shift.station}</td>
                        <td>${shift.hoursWorked} hrs</td>
                        <td><span class="status-completed">${shift.status}</span></td>
                        <td>${shift.notes}</td>
                    </tr>
                `;
            });
            html += `</tbody></table>`;
        }

        html += `
                </div>
            </div>
        `;

        container.innerHTML = html;
    },

    handleDateChange(newDate) {
        AppState.selectedShiftDate = newDate;
        this.render();
    }
};

// Application Router & Tab Switcher
const Router = {
    navigate(tabName) {
        AppState.activeTab = tabName;
        this.refreshCurrentView();
    },

    refreshCurrentView() {
        switch(AppState.activeTab) {
            case 'cook_dashboard':
                CookDashboard.render();
                break;
            case 'shift_manager':
                ShiftManagerDashboard.render();
                break;
            case 'staff_roster':
                const container = document.getElementById('main-content-area');
                if (container) {
                    container.innerHTML = `<div id="staff-roster-container"></div>`;
                    StaffManager.renderStaffRosterUI();
                }
                break;
            case 'recipe_book':
                RecipeBookManager.render();
                break;
            case 'message_board':
                MessageBoardManager.render();
                break;
            case 'training':
                TrainingManager.render();
                break;
            case 'compliance':
                ComplianceManager.render();
                break;
            default:
                CookDashboard.render();
                break;
        }
    }
};

// Application Initialization & Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    console.log('KitchenSync Pro enterprise suite initialized successfully on kitchensync-pro.com');
    Router.navigate('cook_dashboard');
});
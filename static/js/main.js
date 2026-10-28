/**
 * ============================================================================
 * KITCHENSYNC PRO - FULL ENTERPRISE OPERATIONS & MANAGEMENT SUITE
 * Architecture: Modular Vanilla JavaScript ES6+ Architecture
 * Deployment Target: GitHub Pages (kitchensync-pro.com)
 * ============================================================================
 */

const CONFIG = {
    APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxLUl-5Fx1XvJT6jVUURqSeGXT0sFgOB64kESRw4OIC9hxP0hTA4wG46SVV5Ym_UvHJ/exec",
    GM_MASTER_PASSCODE: "9999",
    PROGRAM_START_DATE: "2026-10-01"
};

const Store = {
    lang: 'en',
    role: null,
    user: null,
    employees: [],
    shifts: [],
    certifications: [],
    messages: [],
    recipes: [],
    // Added session-level checklist gating states
    assignedStation: null,
    assignedChecklistKey: null,
    selectedShiftDate: new Date().toISOString().split('T')[0],

    setSession(userObj, roleStr) {
        this.user = userObj;
        this.role = roleStr ? roleStr.toLowerCase() : 'cook';
    },
    clearSession() {
        this.user = null;
        this.role = null;
        this.assignedStation = null;
        this.assignedChecklistKey = null;
    }
};

const ApiService = {
    async request(action, payload) {
        try {
            if (payload) {
                const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify(Object.assign({ action: action }, payload))
                });
                return await res.json();
            } else {
                const res = await fetch(CONFIG.APPS_SCRIPT_URL + '?action=' + encodeURIComponent(action));
                return await res.json();
            }
        } catch (err) {
            console.error('API Error [' + action + ']:', err);
            return null;
        }
    },

    async fetchAll() {
        try {
            const results = await Promise.all([
                this.request('getEmployees'),
                this.request('getShifts'),
                this.request('getCerts'),
                this.request('getMessages'),
                this.request('getRecipes')
            ]);

            if (results[0]) Store.employees = results[0];
            if (results[1]) Store.shifts = results[1];
            if (results[2]) Store.certifications = results[2];
            if (results[3]) Store.messages = results[3];
            if (results[4]) Store.recipes = results[4];

            UIController.refreshActiveView();
        } catch (err) {
            console.error('Error fetching initial data:', err);
        }
    }
};

const UIController = {
    init() {
        const today = new Date().toISOString().split('T')[0];
        ['shift-date', 'cook-shift-date', 'gm-calendar-lookup-date'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = today;
        });
        ApiService.fetchAll();
    },
    refreshActiveView() {
        const view = document.querySelector('.app-view.active');
        if (!view) return;
        const id = view.id.replace('view-', '');
        if (id === 'shift-entry') {
            if (Store.role === 'manager' || Store.role === 'gm') renderManagerChecklist();
            else renderCookChecklistGated();
        }
        if (id === 'cook-dashboard') renderCookDashboard();
        if (id === 'manager-dashboard') {
            renderManagerDashboard();
            renderManagerAssignmentWidget();
        }
        if (id === 'gm-dashboard') {
            renderGMDashboard();
            renderManagerAssignmentWidget();
        }
        if (id === 'cook-training') renderTrainingView();
        if (id === 'recipe-book') renderRecipeBook();
        if (id === 'roster') renderRosterView();
    }
};

document.addEventListener('DOMContentLoaded', () => UIController.init());

// ==========================================
// 1. TRANSLATION ENGINE & DICTIONARY
// ==========================================
const TRANSLATIONS = {
    en: {
        myChecklist: "📝 Station Checklist", shiftsCompleted: "⭐ Shifts Completed",
        trainingModules: "🎓 Training & Certs", managerDashboard: "📊 Shift Manager Dashboard",
        gmSuite: "📈 General Manager Suite", messageBoard: "💬 Message Board",
        recipeBook: "📖 Recipe & Prep Book", staffRoster: "👥 Staff Roster", printSheet: "🖨️ Print Sheet",
        cookDashTitle: "⭐ My Completed Shifts & Performance Log",
        cookDashSub: "Review your past shift checklist history and compliance scores.",
        tblDate: "Date", tblStation: "Station", tblCompletedTasks: "Completed Tasks",
        tblScore: "Score", tblStatus: "Status", noShifts: "No shifts logged yet.",
        goalMet: "✅ Goal Met", missed: "❌ Missed",
        assignedStationLabel: "📍 Assigned Station / Shift:",
        assignedStationSub: "Complete all verification items below for HACCP compliance."
    },
    es: {
        myChecklist: "📝 Lista de Estación", shiftsCompleted: "⭐ Turnos Completados",
        trainingModules: "🎓 Capacitación", managerDashboard: "📊 Panel del Gerente",
        gmSuite: "📈 Suite del Gerente General", messageBoard: "💬 Tablero de Mensajes",
        recipeBook: "📖 Libro de Recetas", staffRoster: "👥 Plantilla de Personal", printSheet: "🖨️ Imprimir Hoja",
        cookDashTitle: "⭐ Mis Turnos Completados y Registro de Rendimiento",
        cookDashSub: "Revise su historial pasado de listas de verificación de turnos y calificaciones de cumplimiento.",
        tblDate: "Fecha", tblStation: "Estación", tblCompletedTasks: "Tareas Completadas",
        tblScore: "Calificación", tblStatus: "Estado", noShifts: "Aún no hay turnos registrados.",
        goalMet: "✅ Meta Cumplida", missed: "❌ Incumplido",
        assignedStationLabel: "📍 Estación / Turno Asignado:",
        assignedStationSub: "Complete todos los elementos de verificación a continuación para cumplir con HACCP."
    }
};

function toggleLanguage() {
    Store.lang = Store.lang === 'en' ? 'es' : 'en';
    const btn = document.getElementById('lang-toggle-btn');
    if (btn) btn.textContent = Store.lang === 'es' ? '🇺🇸 English' : '🇪🇸 Español';
    buildNavForRole(Store.role);
    UIController.refreshActiveView();
}

function t(key) {
    if (TRANSLATIONS[Store.lang] && TRANSLATIONS[Store.lang][key]) return TRANSLATIONS[Store.lang][key];
    if (TRANSLATIONS['en'] && TRANSLATIONS['en'][key]) return TRANSLATIONS['en'][key];
    return key;
}

// ==========================================
// 2. DATA SPECS: ALL 7 CHECKLISTS (BILINGUAL)
// ==========================================
const MANAGER_STATIC_CHECKLIST = [
    { id: 'mc1', title: "Check safe and drawer count for accuracy", desc: "Ensure cash drawers and safe reconcile correctly." },
    { id: 'mc2', title: "Turn on lights, tablets, and Sonos music", desc: "Prepare front-of-house ambiance and terminal readiness." },
    { id: 'mc3', title: "Check bathrooms for cleanliness, trash, and paper goods", desc: "Maintain spotless guest restroom standards." },
    { id: 'mc4', title: "Check staffing for punctuality, call outs, and covers", desc: "Verify team arrival and adjust floor plans as needed." },
    { id: 'mc5', title: "Log call outs or late arrivals when necessary", desc: "Record attendance logs in the management system." },
    { id: 'mc6', title: "Perform BOH line checks for stock, temps, and prep needs", desc: "Ensure all stations meet safety and recipe par levels." },
    { id: 'mc7', title: "Check bar stock and cleanliness", desc: "Inspect bar station inventory and glassware sanitation." },
    { id: 'mc8', title: "Check tables prior to service for cleanliness and condiment stock", desc: "Verify dining room readiness before guest seating." },
    { id: 'mc9', title: "Conduct server and line talk-in for sales expectations, goals, 86 items", desc: "Brief team on daily specials, service goals, and 86'd items." },
    { id: 'mc10', title: "Develop a shift plan for service", desc: "Organize breaks, section rotations, and pacing strategies." },
    { id: 'mc11', title: "Assist servers and hosts with seating, running food, clearing tables", desc: "Support front-of-house flow during peak volume." },
    { id: 'mc12', title: "Expedite at the service slide to maintain quality", desc: "Ensure presentation and ticket times meet brand standards." },
    { id: 'mc13', title: "Monitor labor and make necessary adjustments to control cost", desc: "Cut staff or shift resources based on real-time sales." },
    { id: 'mc14', title: "Close out shift, check safe and drawer counts, SET UP FOR NEXT SHIFT!", desc: "Complete financial reconciliation and preparation handover." },
    { id: 'mc15', title: "Check out line and BOH staff to ensure kitchen is clean, stocked, and 911 prep is completed", desc: "Final walk-through verification of back-of-house closing standards." }
];

const CHECKLIST_SPECS = {
    en: {
        'range_open': [
            {
                phase: "🌅 Range Open Checklist",
                tasks: [
                    { id: 'ro1', title: "Verify gas line connections and pilot lights on all range burners.", desc: "Check all burner ports for clogs or uneven flames." },
                    { id: 'ro2', title: "Check and calibrate all top-stove thermostat controls.", desc: "Verify ice-water bath reads 32°F (0°C)." },
                    { id: 'ro3', title: "Sanitize prep surfaces and stock Sani-buckets (200-400 ppm quat).", desc: "Ensure wells are clean and filled to operational fill line." },
                    { id: 'ro4', title: "Verify holding drawer temperatures (140°F or higher).", desc: "Check expiration labels and FIFO rotation standards." }
                ]
            }
        ],
        'mid_open': [
            {
                phase: "🌅 Mid Open Checklist",
                tasks: [
                    { id: 'mo1', title: "Inspect intermediate prep cooler temperatures (34°F - 38°F).", desc: "Preheat to 350°F and test press mechanism." },
                    { id: 'mo2', title: "Restock squeeze bottles, portion cups, and smallwares.", desc: "Ensure all cheese, sliced meats, and spreads are full and dated." },
                    { id: 'mo3', title: "Check backup inventory in walk-in cooler for afternoon rush.", desc: "Estimate volume for the shift and stage accordingly." },
                    { id: 'mo4', title: "Ensure handwash sinks are fully stocked with soap and paper towels.", desc: "Ensure all food contact surfaces meet health code standards." }
                ]
            }
        ],
        'grill_fry_open': [
            {
                phase: "🌅 Grill/Fry Open Checklist",
                tasks: [
                    { id: 'gfo1', title: "Verify grease traps and fry vats are clean and filled with fresh oil.", desc: "Top off oil if necessary and verify temperature controller at 350°F." },
                    { id: 'gfo2', title: "Test flattop grill surface heating zones evenly.", desc: "Scrape grill surface clean and apply high-temp cooking oil." },
                    { id: 'gfo3', title: "Check fry basket hangers and filtering equipment functionality.", desc: "Ensure back-up inventory is staged within arm's reach." },
                    { id: 'gfo4', title: "Log initial morning oil temperature and quality checks.", desc: "Stage fresh breading, wet batters, and sanitizing buckets." }
                ]
            }
        ],
        'range_mid_split_open': [
            {
                phase: "🌅 Range/Mid-Split Open Checklist",
                tasks: [
                    { id: 'rmso1', title: "Complete safety walk for range and split-station gas lines.", desc: "Verify safe heating temperatures across range and soup wells." },
                    { id: 'rmso2', title: "Verify cross-station inventory par levels for sauces and proteins.", desc: "Ensure sliced proteins, cheeses, and spreads are fully stocked and dated." },
                    { id: 'rmso3', title: "Test emergency shut-off valves and hood suppression pins.", desc: "Equally divide shared mid-station prep tasks with partner." },
                    { id: 'rmso4', title: "Review prep allocation sheet with shift manager.", desc: "Review prep allocation sheet with shift manager." }
                ]
            }
        ],
        'grill_fry_mid_split_open': [
            {
                phase: "🌅 Grill/Fry/Mid-Split Open Checklist",
                tasks: [
                    { id: 'gfmaso1', title: "Full system startup across fryer batteries, grills, and mid-split.", desc: "Preheat grill to 350°F and prepare basket stations." },
                    { id: 'gfmaso2', title: "Calibrate all probe thermometers in ice water and boiling water.", desc: "Support mid-station bread rotation alongside grill startup." },
                    { id: 'gfmaso3', title: "Verify all HACCP temperature logs are initialized for the shift.", desc: "Equally divide shared condiment stocking responsibilities." },
                    { id: 'gfmaso4', title: "Inspect personal protective equipment (heat gloves, aprons).", desc: "Inspect personal protective equipment (heat gloves, aprons)." }
                ]
            }
        ],
        'range_mid_split_close': [
            {
                phase: "🌙 Range/Mid-Split Close Checklist",
                tasks: [
                    { id: 'rcl1', title: "Power down range burners and shut main gas valve securely.", desc: "One hour prior to close, break down veg. and poach pans and bring to dish." },
                    { id: 'rcl2', title: "Degrease burner grates, drip trays, and mid-split stainless steel.", desc: "Brush down range tops and clean under burners." },
                    { id: 'rcl3', title: "Transfer remaining perishable items to walk-in cooler with date labels.", desc: "Clean traps for range and small grill. Shut down one oven." },
                    { id: 'rcl4', title: "Sweep and mop kitchen floors using approved sanitizer solution.", desc: "Clean all stainless in egg station, including oven doors, traulsens, and table." }
                ]
            }
        ],
        'grill_fry_mid_split_close': [
            {
                phase: "🌙 Grill/Fry/Mid-Split Close Checklist",
                tasks: [
                    { id: 'gcl1', title: "Perform boil-out procedure on fryers and filter cooking oil.", desc: "One hour prior to close, flip pancake batter to a 6th pan with a ladle." },
                    { id: 'gcl2', title: "Scrape, polish, and oil flattop grill surfaces.", desc: "Bring the batter gun to dish." },
                    { id: 'gcl3', title: "Empty and sanitize grease collection bins and waste containers.", desc: "Wipe and scrub lower shelf of the grill and clean temperature dials." },
                    { id: 'gcl4', title: "Lock down back doors, verify equipment power-downs, and set alarm.", desc: "Strain the fryers of excess crumbs and food particles." }
                ]
            }
        ]
    },
    es: {
        'range_open': [
            {
                phase: "🌅 Lista de Apertura de Cocina (Range)",
                tasks: [
                    { id: 'ro1', title: "Verifique las conexiones de gas y las luces piloto en todos los quemadores.", desc: "Check all burner ports for clogs or uneven flames." },
                    { id: 'ro2', title: "Verifique y calibre todos los controles de termostato de la estufa.", desc: "Verify ice-water bath reads 32°F (0°C)." },
                    { id: 'ro3', title: "Desinfecte las superficies y prepare los cubos sanitizantes (200-400 ppm).", desc: "Ensure wells are clean and filled to operational fill line." },
                    { id: 'ro4', title: "Verifique las temperaturas de los cajones térmicos (140°F o más).", desc: "Check expiration labels and FIFO rotation standards." }
                ]
            }
        ],
        'mid_open': [
            {
                phase: "🌅 Lista de Apertura Intermedia (Mid)",
                tasks: [
                    { id: 'mo1', title: "Inspeccione las temperaturas del refrigerador intermedio (34°F - 38°F).", desc: "Preheat to 350°F and test press mechanism." },
                    { id: 'mo2', title: "Reabastezca botellas exprimibles, tazas de porción y utensilios pequeños.", desc: "Ensure all cheese, sliced meats, and spreads are full and dated." },
                    { id: 'mo3', title: "Verifique el inventario de respaldo en el refrigerador grande para la tarde.", desc: "Estimate volume for the shift and stage accordingly." },
                    { id: 'mo4', title: "Asegúrese de que los lavabos tengan jabón y toallas de papel.", desc: "Ensure all food contact surfaces meet health code standards." }
                ]
            }
        ],
        'grill_fry_open': [
            {
                phase: "🌅 Lista de Apertura de Plancha y Freidora",
                tasks: [
                    { id: 'gfo1', title: "Verifique que las trampas de grasa y freidoras estén limpias y con aceite fresco.", desc: "Top off oil if necessary and verify temperature controller at 350°F." },
                    { id: 'gfo2', title: "Pruebe las zonas de calentamiento de la superficie de la plancha de manera uniforme.", desc: "Scrape grill surface clean and apply high-temp cooking oil." },
                    { id: 'gfo3', title: "Verifique el funcionamiento de los ganchos de las canastas y equipos de filtrado.", desc: "Ensure back-up inventory is staged within arm's reach." },
                    { id: 'gfo4', title: "Registre las comprobaciones iniciales de temperatura y calidad del aceite.", desc: "Stage fresh breading, wet batters, and sanitizing buckets." }
                ]
            }
        ],
        'range_mid_split_open': [
            {
                phase: "🌅 Lista de Apertura Dividida Range/Mid",
                tasks: [
                    { id: 'rmso1', title: "Complete la caminata de seguridad para las líneas de gas de range y mid.", desc: "Verify safe heating temperatures across range and soup wells." },
                    { id: 'rmso2', title: "Verifique los niveles de inventario cruzado para salsas y proteínas.", desc: "Ensure sliced proteins, cheeses, and spreads are fully stocked and dated." },
                    { id: 'rmso3', title: "Pruebe las válvulas de cierre de emergencia y los pines de supresión de campana.", desc: "Equally divide shared mid-station prep tasks with partner." },
                    { id: 'rmso4', title: "Revise la hoja de asignación de preparación con el gerente de turno.", desc: "Review prep allocation sheet with shift manager." }
                ]
            }
        ],
        'grill_fry_mid_split_open': [
            {
                phase: "🌅 Lista de Apertura Completa Grill/Fry/Mid-Split",
                tasks: [
                    { id: 'gfmaso1', title: "Inicio completo del sistema en baterías de freidoras, planchas y mid-split.", desc: "Preheat grill to 350°F and prepare basket stations." },
                    { id: 'gfmaso2', title: "Calibre todos los termómetros de sonda en agua con hielo y agua hirviendo.", desc: "Support mid-station bread rotation alongside grill startup." },
                    { id: 'gfmaso3', title: "Verifique que todos los registros de temperatura HACCP estén iniciados.", desc: "Equally divide shared condiment stocking responsibilities." },
                    { id: 'gfmaso4', title: "Inspeccione el equipo de protección personal (guantes térmicos, delantales).", desc: "Inspect personal protective equipment (heat gloves, aprons)." }
                ]
            }
        ],
        'range_mid_split_close': [
            {
                phase: "🌙 Lista de Cierre Dividida Range/Mid",
                tasks: [
                    { id: 'rcl1', title: "Apague los quemadores y cierre la válvula principal de gas de forma segura.", desc: "One hour prior to close, break down veg. and poach pans and bring to dish." },
                    { id: 'rcl2', title: "Desengrase las rejillas de los quemadores, bandejas y acero inoxidable.", desc: "Brush down range tops and clean under burners." },
                    { id: 'rcl3', title: "Transfiera los perecederos restantes al refrigerador con etiquetas de fecha.", desc: "Clean traps for range and small grill. Shut down one oven." },
                    { id: 'rcl4', title: "Barra y trapee los pisos de la cocina usando solución desinfectante aprobada.", desc: "Clean all stainless in egg station, including oven doors, traulsens, and table." }
                ]
            }
        ],
        'grill_fry_mid_split_close': [
            {
                phase: "🌙 Lista de Cierre Completa Grill/Fry/Mid-Split",
                tasks: [
                    { id: 'gcl1', title: "Realice el procedimiento de hervor en las freidoras y filtre el aceite.", desc: "One hour prior to close, flip pancake batter to a 6th pan with a ladle." },
                    { id: 'gcl2', title: "Raspe, pula y engrase las superficies de la plancha plana.", desc: "Bring the batter gun to dish." },
                    { id: 'gcl3', title: "Vacíe y desinfecte los contenedores de recolección de grasa y residuos.", desc: "Wipe and scrub lower shelf of the grill and clean temperature dials." },
                    { id: 'gcl4', title: "Asegure las puertas traseras, verifique apagados y active la alarma.", desc: "Strain the fryers of excess crumbs and food particles." }
                ]
            }
        ]
    }
};

// ==========================================
// 3. SERVSAFE COMPLIANT TRAINING MODULES
// ==========================================
const TRAINING_MODULES = [
    {
        id: 'MOD-01', title: "Module 1: Providing Safe Food & Biological Contamination",
        description: "Master foodborne illness outbreaks, biological pathogens, bacteria, viruses, parasites, and fungi.",
        questions: [
            { q: "What is a foodborne illness outbreak?", options: ["When two or more people get the same illness after eating the same food", "When one person gets sick from restaurant food", "When food is contaminated by cleaning chemicals", "When raw meat touches vegetables"], correct: 0 },
            { q: "Which of the following is a biological contaminant?", options: ["Glass shards in a salad", "Norovirus in oysters", "Sanitizer residue on a plate", "Jewelry falling into soup"], correct: 1 },
            { q: "What are the 'Big Six' pathogens most highly contagious?", options: ["Shigella, Salmonella Typhi, Nontyphoidal Salmonella, E. coli, Hepatitis A, Norovirus", "Staph, Listeria, Botulism, Clostridium perfringens, Bacillus cereus, Vibrio", "Common cold, Influenza, Strep throat, Chickenpox, Measles, Mumps", "Mold, Yeast, Mildew, Rust, Algae, Spores"], correct: 0 },
            { q: "What is the primary symptom that requires excluding a food handler from the operation?", options: ["Mild headache", "Vomiting", "Slight fatigue", "Runny nose"], correct: 1 },
            { q: "Bacteria grow exceptionally well in food that contains:", options: ["High acidity", "Little to no moisture", "Little or no acid (pH 4.6 to 7.5) and protein/carbs", "High salinity and high sugar"], correct: 2 },
            { q: "What condition is required for bacterial growth represented by the 'T' in FAT TOM?", options: ["Time", "Temperature", "Toxins", "Texture"], correct: 1 },
            { q: "Which virus is primarily linked with ready-to-eat foods and shellfish from contaminated water?", options: ["Hepatitis A", "Rabies", "Rotavirus", "Influenza"], correct: 0 },
            { q: "Parasites are commonly linked with what type of food?", options: ["Dry grains and cereals", "Seafood and wild game", "Pasteurized dairy", "Canned vegetables"], correct: 1 },
            { q: "Fungi include which of the following organisms?", options: ["Bacteria and viruses", "Molds and yeasts", "Parasites and protozoa", "Insects and rodents"], correct: 1 },
            { q: "What is the best way to prevent bacterial spores from surviving in cooked food?", options: ["Rinsing food in cold water", "Cooking food to required minimum internal temperatures", "Storing food in direct sunlight", "Adding extra table salt"], correct: 1 }
        ]
    },
    {
        id: 'MOD-02', title: "Module 2: Personal Hygiene & Employee Health",
        description: "Proper handwashing procedures, personal cleanliness, work attire, and illness reporting.",
        questions: [
            { q: "What is the minimum total time you should scrub your hands with soap during handwashing?", options: ["3 to 5 seconds", "10 to 15 seconds", "30 to 45 seconds", "60 seconds"], correct: 1 },
            { q: "When must food handlers wash their hands?", options: ["Only at the start of a shift", "After touching raw meat, using the restroom, or handling garbage", "Only when changing stations", "Only if hands look visibly dirty"], correct: 1 },
            { q: "What is the correct way to dry hands after washing?", options: ["On your apron or uniform pants", "Using a single-use paper towel or warm-air dryer", "By waving them in the air until dry", "Using a shared cloth towel kept by the sink"], correct: 1 },
            { q: "Where is it acceptable to drink from an open beverage cup while working?", options: ["At any prep table if covered", "Only in designated employee break areas", "Next to the cooking line", "In the dishwashing area"], correct: 1 },
            { q: "What jewelry is generally permitted on food handlers' hands or arms?", options: ["A diamond engagement ring", "A plain metal band ring", "A wristwatch with a leather strap", "A medical alert bracelet"], correct: 1 },
            { q: "What should a food handler do if they have an infected cut on their hand?", options: ["Bandage the wound and cover it with a waterproof single-use glove", "Ignore it if it is small", "Wash hands twice as often", "Wear a sweatband over it"], correct: 0 },
            { q: "When must single-use gloves be changed?", options: ["Every 8 hours regardless of tasks", "As soon as they become torn, soiled, or when switching tasks", "Only at the end of the shift", "Only when handling raw poultry"], correct: 1 },
            { q: "Which symptom requires a food handler to be restricted from working around food but not necessarily excluded?", options: ["Sore throat with fever", "Active vomiting", "Jaundice", "Diarrhea"], correct: 0 },
            { q: "What hair restraint must food handlers wear in food prep areas?", options: ["A clean hat or hairnet", "Only hairspray", "A tight ponytail", "No restraint is required if hair is short"], correct: 0 },
            { q: "Before putting on single-use gloves, what must a food handler always do?", options: ["Apply hand lotion", "Wash their hands", "Sanitize the gloves", "Blow into the gloves to open them"], correct: 1 }
        ]
    },
    {
        id: 'MOD-03', title: "Module 3: Flow of Food - Introduction & Purchasing",
        description: "Managing cross-contamination, time-temperature abuse, approved suppliers, and receiving criteria.",
        questions: [
            { q: "What is the temperature danger zone range where bacteria grow rapidly?", options: ["32°F to 40°F", "41°F to 135°F", "140°F to 212°F", "0°F to 32°F"], correct: 1 },
            { q: "How can cross-contamination be prevented during food storage?", options: ["Storing raw meat above ready-to-eat food", "Using separate cutting boards and storing raw poultry below ready-to-eat food", "Storing cleaning chemicals next to flour", "Wiping down counters with dry rags"], correct: 1 },
            { q: "What is the calibration boiling-point method temperature for standard dial thermometers at sea level?", options: ["32°F", "100°F", "212°F", "350°F"], correct: 2 },
            { q: "At what internal temperature should cold TCS food be received?", options: ["41°F (5°C) or lower", "50°F (10°C) or lower", "60°F (15°C) or lower", "32°F (0°C) or lower"], correct: 0 },
            { q: "At what internal temperature should hot TCS food be received?", options: ["100°F (38°C) or higher", "135°F (57°C) or higher", "165°F (74°C) or higher", "212°F (100°C) or higher"], correct: 1 },
            { q: "Live shellfish must be received with what documentation attached?", options: ["A USDA inspection stamp", "An invoice marked paid in full", "An approved shellstock identification tag", "A weight certificate"], correct: 2 },
            { q: "What is required for packaged food delivered in damaged or torn containers?", options: ["Accept it if the price is discounted", "Reject the delivery immediately", "Transfer the food into clean bags", "Rinse the outer packaging in bleach water"], correct: 1 },
            { q: "What is the maximum acceptable receiving temperature for fresh shell eggs?", options: ["41°F or lower", "45°F or lower", "50°F or lower", "60°F or lower"], correct: 1 },
            { q: "What action should be taken if frozen food shows evidence of thawing and refreezing (ice crystals)?", options: ["Cook it immediately", "Reject the shipment", "Thaw it in warm water", "Refreeze it in the blast chiller"], correct: 1 },
            { q: "What is an approved supplier?", options: ["Any vendor who delivers locally", "A supplier inspected and complying with local, state, and federal laws", "A supplier offering the lowest wholesale prices", "Any farmer selling produce at a roadside stand"], correct: 1 }
        ]
    },
    {
        id: 'MOD-04', title: "Module 4: Flow of Food - Preparation & Thawing",
        description: "Safe food preparation guidelines, thawing methods, and prep controls for TCS foods.",
        questions: [
            { q: "What is the maximum time food can remain in the temperature danger zone before being discarded?", options: ["1 hour", "2 hours", "4 hours", "6 hours"], correct: 2 },
            { q: "Which of the following is an approved method for thawing TCS food?", options: ["Thawing on the kitchen prep counter at room temperature", "Thawing submerged in running potable water at 70°F (21°C) or lower", "Thawing in a sink filled with warm soapy water", "Thawing directly under heat lamps"], correct: 1 },
            { q: "What internal cooking temperature is required for poultry (whole or ground chicken, turkey)?", options: ["135°F for 15 seconds", "155°F for 15 seconds", "165°F for 15 seconds for instantaneous reading", "175°F for 15 seconds"], correct: 2 },
            { q: "What internal cooking temperature is required for ground beef and pork?", options: ["135°F", "145°F", "155°F for 15 seconds", "165°F"], correct: 2 },
            { q: "What is the required minimum internal cooking temperature for seafood, steaks, and chops of pork/beef?", options: ["135°F", "145°F for 15 seconds", "155°F", "165°F"], correct: 1 },
            { q: "What is the required minimum cooking temperature for commercially raised game animals, ratites, and stuffed meats?", options: ["145°F", "155°F", "165°F for 15 seconds", "175°F"], correct: 2 },
            { q: "What is the first stage of the two-stage cooling process for TCS foods?", options: ["Cooling from 135°F to 70°F within 2 hours", "Cooling from 135°F to 41°F within 6 hours total", "Cooling from 70°F to 41°F within 4 hours", "Cooling immediately in a freezer"], correct: 0 },
            { q: "What is the total maximum combined time allowed for cooling TCS food?", options: ["2 hours", "4 hours", "6 hours", "8 hours"], correct: 2 },
            { q: "What must be done to reheated TCS food intended for hot holding?", options: ["Heat to an internal temperature of 165°F for 15 seconds within 2 hours", "Warm gently on a steam table until piping hot", "Rinse in boiling water", "Microwave for 30 seconds"], correct: 0 },
            { q: "When prepping food, what is the best practice to prevent time-temperature abuse?", options: ["Prep large batches all at once and leave them on the counter", "Prep food in small batches to limit time in the danger zone", "Turn off kitchen air conditioning", "Use warm water for all prep work"], correct: 1 }
        ]
    },
    {
        id: 'MOD-05', title: "Module 5: Flow of Food - Service & Holding",
        description: "Holding hot and cold foods, self-service safety, off-site service, and tableware re-service.",
        questions: [
            { q: "At what minimum temperature must hot TCS food be held during service?", options: ["120°F", "135°F or higher", "150°F", "165°F"], correct: 1 },
            { q: "At what maximum temperature must cold TCS food be held during service?", options: ["32°F", "41°F (5°C) or lower", "50°F", "60°F"], correct: 1 },
            { q: "How frequently must internal temperatures of hot/cold holding food be checked?", options: ["Every 30 minutes", "At least every 4 hours (ideally every 2 hours)", "Once at the start of the shift", "Once at the end of the day"], correct: 1 },
            { q: "Without temperature control, cold food can be held for up to how many hours if labeled and maintained under 70°F?", options: ["2 hours", "4 hours", "6 hours", "8 hours"], correct: 2 },
            { q: "What is a key rule regarding self-service salad bars and buffets?", options: ["Customers can reuse their dirty plates for second helpings", "Provide clean plates and utensils for each new trip to the buffet", "Store raw meat above ready-to-eat salad items", "Leave sneeze guards open for easy access"], correct: 1 },
            { q: "Which food item can legally be re-served to another customer if untouched?", options: ["An open bowl of salsa", "An unopened pre-packaged cracker or condiment packet", "A basket of unfinished dinner rolls", "A partial drink glass"], correct: 1 },
            { q: "When transporting food off-site, what is required of delivery vehicles?", options: ["Insulated food-grade containers that keep food safe", "Open-air truck beds", "Uninsulated cardboard boxes", "Air-conditioned passenger seats"], correct: 0 },
            { q: "What is the maximum holding time for hot TCS food held without temperature control?", options: ["2 hours", "4 hours", "6 hours", "8 hours"], correct: 0 },
            { q: "Where must sneeze guards be installed on a food display bar?", options: ["Below the food level", "At least 14 inches above the food counter extending outward", "Directly touching the food pans", "Only behind the kitchen service window"], correct: 1 },
            { q: "What must be included on food labels for items prepared in-house and held for over 24 hours?", options: ["The cook's home address", "Name of the food and the use-by/discard date (max 7 days at 41°F)", "The wholesale cost", "The exact recipe ingredients"], correct: 1 }
        ]
    },
    {
        id: 'MOD-06', title: "Module 6: Food Safety Management Systems & HACCP",
        description: "Active managerial control, prerequisite programs, and the 7 principles of HACCP.",
        questions: [
            { q: "What is active managerial control?", options: ["Waiting for a health inspector to find violations", "The manager's proactive approach to controlling foodborne illness risk factors", "Delegating all kitchen tasks to line cooks", "Keeping doors locked during rush hours"], correct: 1 },
            { q: "What does HACCP stand for?", options: ["Hazard Analysis Critical Control Point", "Health And Cleanliness Critical Control Procedures", "Hygiene And Consumer Care Protocol", "Hazard Assessment Control Center Program"], correct: 0 },
            { q: "What is the first principle in a HACCP plan?", options: ["Establish critical limits", "Conduct a hazard analysis", "Establish monitoring procedures", "Verify that the system works"], correct: 1 },
            { q: "What is a Critical Control Point (CCP)?", options: ["The final invoice price of food", "A point in the flow of food where a hazard can be prevented, eliminated, or reduced to safe levels", "The employee break room schedule", "The time when health inspectors arrive"], correct: 1 },
            { q: "Establishing critical limits in HACCP involves what action?", options: ["Setting maximum or minimum parameters like cooking temperatures", "Writing employee reprimands", "Counting inventory items", "Checking restroom supplies"], correct: 0 },
            { q: "What is corrective action in HACCP?", options: ["Firing a cook who makes a mistake", "The procedure followed when a critical limit is not met", "Throwing out all kitchen trash", "Cleaning grease traps weekly"], correct: 1 },
            { q: "What is the purpose of verification in a HACCP system?", options: ["Checking that the HACCP plan is working properly through logs and reviews", "Checking customer credit cards", "Ensuring employees wear clean uniforms", "Verifying delivery truck mileage"], correct: 0 },
            { q: "Which food is most vulnerable and commonly associated with a HACCP plan requirement?", options: ["Dry pasta", "Packaged crackers", "Juice squeezed and packaged in-house", "Bottled water"], correct: 2 },
            { q: "What is the final principle of HACCP?", options: ["Establish record-keeping and documentation procedures", "Determine pricing strategies", "Order weekly linen supplies", "Conduct employee interviews"], correct: 0 },
            { q: "Which of the following represents a biological hazard managed by HACCP?", options: ["Cleaning chemical spills", "Salmonella contamination in poultry", "Metal shavings from a can opener", "Broken floor tiles"], correct: 1 }
        ]
    },
    {
        id: 'MOD-07', title: "Module 7: Cleaning, Sanitizing & Facility Management",
        description: "Difference between cleaning and sanitizing, three-compartment sinks, dishwasher specs, and facility safety.",
        questions: [
            { q: "What is the difference between cleaning and sanitizing?", options: ["Cleaning removes food and dirt; sanitizing reduces pathogens to safe levels", "Cleaning kills germs; sanitizing removes grease", "They mean the exact same thing", "Cleaning is for floors; sanitizing is for dishes"], correct: 0 },
            { q: "What is the correct order of steps for manual dishwashing in a 3-compartment sink?", options: ["Sanitize, Rinse, Wash, Air Dry", "Wash in clean detergent water, Rinse in clean water, Sanitize, Air dry", "Rinse, Wash, Sanitize, Towel dry", "Wash, Sanitize, Rinse, Towel dry"], correct: 1 },
            { q: "What is the minimum water temperature required for the sanitizing rinse in a hot-water sanitizing dishwasher?", options: ["140°F", "165°F", "180°F (82°C)", "212°F"], correct: 2 },
            { q: "What chemical concentration range is standard for chlorine (bleach) sanitizer in a 3-compartment sink?", options: ["10-25 ppm", "50-99 ppm", "200-400 ppm", "500-800 ppm"], correct: 1 },
            { q: "What is the required concentration range for quaternary ammonium (quat) sanitizers?", options: ["10-25 ppm", "50-99 ppm", "200-400 ppm", "500-1000 ppm"], correct: 2 },
            { q: "How should sanitized tableware and utensils be stored?", options: ["Stacked directly on the floor", "At least 6 inches off the floor, covered or inverted", "In wet dish rags", "On open outdoor patios"], correct: 1 },
            { q: "What is an air gap in plumbing?", options: ["An open space between two doors", "An air space that separates a water supply outlet from a potentially contaminated source", "A vent in the roof", "A gap in the walk-in freezer seal"], correct: 1 },
            { q: "What lighting intensity is required in food prep areas?", options: ["10 foot-candles", "20 foot-candles", "50 foot-candles (540 lux)", "100 foot-candles"], correct: 2 },
            { q: "What is backflow?", options: ["Water flowing backward from a drainage system into a safe water supply", "Food flowing out of a piping bag", "Dishes sliding off a tray", "Exhaust fans blowing inward"], correct: 0 },
            { q: "Where must wet wiping cloths be stored when not in use?", options: ["On top of prep tables", "In a bucket of sanitizer solution at correct concentration", "In employee apron pockets", "In the handwashing sink"], correct: 1 }
        ]
    },
    {
        id: 'MOD-08', title: "Module 8: Pest Management & Integrated Defense",
        description: "Preventing pests, identifying signs of infestation, and working with licensed pest control operators.",
        questions: [
            { q: "What are the three main rules of an Integrated Pest Management (IPM) program?", options: ["Deny pests access, deny pests food/water/shelter, work with a licensed PCO", "Spray chemicals daily, set traps weekly, lock doors at night", "Hire exterminators, clean floors hourly, discard all dry goods", "Ignore small mice, bait exterior doors, use open traps inside"], correct: 0 },
            { q: "What is a sign of a cockroach infestation?", options: ["Shredded paper nests", "Capsule-shaped egg cases (oothecae) and strong oily odors", "Green fuzzy mold on walls", "Clean grease traps"], correct: 1 },
            { q: "What is a sign of rodent activity?", options: ["Small pellet droppings, gnaw marks on wood/packaging, and rub marks along walls", "Small green leaves on the floor", "Damp water puddles", "Dry flour dust"], correct: 0 },
            { q: "How high off the floor must food and supplies be stored on shelving to prevent pest nesting?", options: ["At least 2 inches", "At least 4 inches", "At least 6 inches (15 cm)", "At least 12 inches"], correct: 2 },
            { q: "What should you do if you notice pesticide residue on clean prep counters?", options: ["Wipe it with a dry rag", "Wash, rinse, and sanitize the surface immediately", "Ignore it since it kills bugs", "Cover it with foil"], correct: 1 },
            { q: "Why must outer doors and windows be tightly fitted and self-closing?", options: ["To lower heating bills", "To prevent flying and crawling pests from entering", "To reduce noise levels", "To comply with fire codes"], correct: 1 },
            { q: "What is a fly air curtain?", options: ["A fan mounted above doors that blows a steady stream of air downward to deter flies", "A net placed over windows", "An electronic zapper in the dining room", "An exhaust hood filter"], correct: 0 },
            { q: "Where should garbage containers be kept to discourage pests?", options: ["Directly next to the kitchen back door inside", "Clean, covered, and stored on a paved, non-absorbent surface outside", "Inside the walk-in cooler", "Stacked in the dining room"], correct: 1 },
            { q: "Who should apply restricted-use pesticides in a food establishment?", options: ["Any trained line cook", "A licensed pest control operator (PCO)", "The evening shift supervisor", "The general manager"], correct: 1 },
            { q: "What is the best way to deny pests shelter?", options: ["Keep facilities clean, dispose of garbage promptly, and seal cracks/crevices", "Leave lights on 24/7", "Keep storage rooms humid", "Store boxes directly on concrete floors"], correct: 0 }
        ]
    },
    {
        id: 'MOD-09', title: "Module 9: Food Allergens & Cross-Contact Prevention",
        description: "The Big Nine allergens, recognizing allergic reactions, and kitchen cross-contact prevention.",
        questions: [
            { q: "What are the 'Big Nine' major food allergens?", options: ["Milk, eggs, fish, shellfish, tree nuts, peanuts, wheat, soybeans, sesame", "Beef, pork, chicken, lamb, venison, duck, turkey, rabbit, veal", "Corn, rice, oats, barley, rye, potato, tomato, garlic, onion", "Salt, sugar, pepper, vinegar, oil, butter, mustard, ketchup, mayo"], correct: 0 },
            { q: "What is food cross-contact?", options: ["When raw meat touches ready-to-eat food", "When allergens are transferred from allergen-containing food or surfaces to food served to a customer", "When two employees bump into each other", "When food is overcooked"], correct: 1 },
            { q: "Which of the following is a symptom of a severe allergic reaction (anaphylaxis)?", options: ["Slight drowsiness", "Tightening of the throat, wheezing, and hives", "Mild sunburn", "Runny nose"], correct: 1 },
            { q: "What must service staff do when a customer informs them of a food allergy?", options: ["Guess whether the dish is safe", "Notify the kitchen staff clearly, check ingredient labels, and ensure dedicated prep equipment is used", "Tell the customer to pick around the allergen", "Ignore it if the allergy is mild"], correct: 1 },
            { q: "Which ingredient is classified as a tree nut allergen?", options: ["Peanuts", "Walnuts", "Soybeans", "Sesame seeds"], correct: 1 },
            { q: "How can kitchen staff prevent allergen cross-contact on griddles and fryers?", options: ["Wipe the surface with a wet sponge", "Use dedicated fryers, separate pans, and thoroughly clean/sanitize equipment before cooking allergen-free orders", "Cook all orders together to save time", "Add extra lemon juice"], correct: 1 },
            { q: "Which food is part of the crustacean shellfish allergen group?", options: ["Tuna", "Shrimp", "Salmon", "Cod"], correct: 1 },
            { q: "What is an effective response if a customer is experiencing anaphylactic shock in your restaurant?", options: ["Give them a glass of water", "Call 911 immediately and inform emergency responders of the suspected allergen", "Have them lie down on the kitchen floor", "Wait 30 minutes to see if symptoms subside"], correct: 1 },
            { q: "Is sesame considered one of the major food allergens?", options: ["No, it is just a garnish", "Yes, it is part of the Big Nine federal allergen requirements", "Only when served raw", "Only in bakery items"], correct: 1 },
            { q: "What should be done with a dish if allergen cross-contact is suspected during plating?", options: ["Scrape off the allergen", "Discard the dish and prepare a fresh order using clean equipment", "Microwave it for 1 minute", "Serve it to a different table"], correct: 1 }
        ]
    },
    {
        id: 'MOD-10', title: "Module 10: Government Regulations, Sanitation Standards & Crisis Management",
        description: "Health inspections, regulatory agencies, food safety recalls, and crisis management protocols.",
        questions: [
            { q: "Which agency writes the Model Food Code providing science-based food safety guidelines?", options: ["FDA (Food and Drug Administration)", "OSHA", "EPA", "USDA"], correct: 0 },
            { q: "What is the role of local/state health departments in food safety?", options: ["Inspecting operations, enforcing regulations, and issuing permits", "Setting federal tax rates", "Managing restaurant payroll", "Designing kitchen equipment"], correct: 0 },
            { q: "When a health inspector conducts an inspection, what is required of the manager?", options: ["Deny entry until an appointment is scheduled", "Accompany the inspector, cooperate fully, and take notes on any findings", "Bribe the inspector to ignore violations", "Leave the building immediately"], correct: 1 },
            { q: "What triggers a voluntary or mandatory food product recall?", options: ["When food items are past their seasonal peak", "When a food product is contaminated, mislabeled, or poses a health hazard", "When wholesale prices drop", "When a restaurant closes for renovations"], correct: 1 },
            { q: "What should you do if notified of a food product recall in your operation?", options: ["Serve it quickly before customers notice", "Locate the recalled item, remove it from inventory, label it 'Do Not Use', and store separately", "Donate it to a local homeless shelter", "Throw it in the regular dumpster unlocked"], correct: 1 },
            { q: "What constitutes an imminent health hazard requiring immediate closure of the facility?", options: ["A burned-out light bulb in the dining room", "A major water interruption, sewage backup, or severe pest infestation", "A broken cash register", "A delayed food delivery"], correct: 1 },
            { q: "What is the primary focus of OSHA regulations in a restaurant?", options: ["Food temperature logs", "Worker safety, hazard communication, and chemical safety data sheets (SDS)", "Customer seating capacity", "Menu pricing standards"], correct: 1 },
            { q: "Where must Safety Data Sheets (SDS) for cleaning chemicals be kept?", options: ["Locked in the manager's private home safe", "Accessible to all employees for all chemicals used in the workplace", "Filed away in the corporate office in another state", "Discarded after chemical containers are opened"], correct: 1 },
            { q: "What is the correct action if a water service main breaks during lunch service?", options: ["Keep cooking with standing tap water", "Stop food preparation immediately, evaluate the hazard, and notify the health authority if necessary", "Use bottled water for boiling pasta only", "Ignore it until closing time"], correct: 1 },
            { q: "What is the definition of a critical violation on a health inspection report?", options: ["A dusty ceiling fan", "A food safety violation directly linked to foodborne illness (e.g., improper holding temperatures)", "A scuffed floor tile", "A missing employee name tag"], correct: 1 }
        ]
    }
];

// ==========================================
// 4. AUTHENTICATION & NAVIGATION ROUTER
// ==========================================
function handleLogin(e) {
    e.preventDefault();
    const passwordInput = document.getElementById('auth-password');
    if (!passwordInput) return;
    const pin = passwordInput.value.trim();

    if (pin === CONFIG.GM_MASTER_PASSCODE) {
        Store.setSession({ id: "GM-ADMIN", name: "General Manager", role: "gm", station: "All" }, "gm");
        finalizeLogin();
        return;
    }

    const emp = Store.employees.find(e => String(e.pin || e.PIN).trim() === pin && (e.active === true || String(e.active).toLowerCase() === 'true'));
    if (emp) {
        Store.setSession(emp, emp.role || emp.Role || 'cook');
        finalizeLogin();
        return;
    }

    ApiService.request('authenticate', { password: pin }).then(res => {
        if (res && res.success) {
            Store.setSession(res.employee || { id: "EMP-001", name: "Employee", role: res.role || "cook", station: "range_open" }, res.role || 'cook');
            finalizeLogin();
        } else {
            alert(res && res.error ? res.error : "Invalid PIN or Passcode.");
        }
    });
}

function finalizeLogin() {
    document.getElementById('auth-modal').style.display = 'none';
    document.getElementById('app-wrapper').style.display = 'block';
    
    // Automatically bind any pre-assigned station from the database record upon login
    if (Store.user && Store.user.station && Store.user.station !== 'All' && Store.user.station !== 'Management') {
        Store.assignedChecklistKey = Store.user.station;
        Store.assignedStation = Store.user.station.replace(/_/g, ' ').toUpperCase();
    }

    updateGreetingLabel();
    buildNavForRole(Store.role);
    renderChecklists();
}

function renderCookChecklistGated() {
    const container = document.getElementById('checklist-container');
    if (!container) return;
    container.innerHTML = '';

    // If session state is empty, check if Store.user has a saved station from the database
    if ((!Store.assignedStation || !Store.assignedChecklistKey) && Store.user && Store.user.station) {
        Store.assignedChecklistKey = Store.user.station;
        Store.assignedStation = Store.user.station.replace(/_/g, ' ').toUpperCase();
    }

    if (!Store.assignedStation || !Store.assignedChecklistKey) {
        container.innerHTML = `
            <div class="card" style="background: #fffbeb; border: 1px solid #fde68a; text-align: center; padding: 2.5rem;">
                <h3 style="color: #b45309; margin-top: 0;">👨‍🍳 Cook's Dashboard - Station Access Pending</h3>
                <p style="color: #92400e; font-size: 0.95rem;">No checklist or station has been assigned to you yet by a Manager or Shift Manager.</p>
                <p style="color: #78350f; font-size: 0.85rem;">Please contact your shift supervisor to assign your active opening or closing station.</p>
            </div>
        `;
        return;
    }

    const assignedKey = Store.assignedChecklistKey;
    const assignedTitle = Store.assignedStation;
    const specs = CHECKLIST_SPECS[Store.lang]?.[assignedKey] || CHECKLIST_SPECS['en'][assignedKey] || CHECKLIST_SPECS['en']['range_open'];

    const banner = document.createElement('div');
    banner.className = 'card';
    banner.style.cssText = 'margin-bottom: 1.5rem; background: #f0fdf4; border: 1px solid #bbf7d0;';
    banner.innerHTML = `<h3 style="color: #166534; margin: 0;">${t('assignedStationLabel')} ${assignedTitle}</h3><p style="margin:4px 0 0 0;font-size:0.85rem;color:#15803d;">${t('assignedStationSub')}</p>`;
    container.appendChild(banner);

    specs.forEach(sec => {
        let html = `<h3 class="checklist-section-title" style="color:#1e3a8a; margin-bottom:0.75rem;">${sec.phase}</h3>`;
        sec.tasks.forEach((task, idx) => {
            html += `<div class="task-row" style="display:flex; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid #f1f5f9;"><input type="checkbox" class="task-checkbox" id="cb-cook-${idx}" style="width:20px;height:20px;cursor:pointer;"><div><div class="task-title" style="font-weight:600; color:#334155;">${task.title}</div><div class="task-desc" style="font-size:0.85rem; color:#64748b;">${task.desc}</div></div></div>`;
        });
        container.innerHTML += `<div class="card checklist-section">${html}</div>`;
    });

    container.innerHTML += `<div style="margin-top: 1.5rem; display: flex; gap: 10px; align-items: center; flex-wrap: wrap;"><button class="btn btn-primary" onclick="submitCookShiftChecklist()">💾 Submit Completed Station Checklist</button></div>`;
}

function updateGreetingLabel() {
    const label = document.getElementById('logged-in-user-label');
    if (label && Store.user) {
        const certified = isCertifiedTeamLeader(Store.user.id);
        const badge = certified ? (Store.lang === 'es' ? ' ⭐️ LÍDER DE EQUIPO CERTIFICADO' : ' ⭐️ CERTIFIED TEAM LEADER') : '';
        label.textContent = `${Store.user.name}${badge} (${Store.role.toUpperCase()})`;
    }
}

function logoutSession() {
    Store.clearSession();
    document.getElementById('auth-password').value = '';
    document.getElementById('app-wrapper').style.display = 'none';
    document.getElementById('auth-modal').style.display = 'flex';
}

function buildNavForRole(role) {
    const nav = document.getElementById('nav-tabs-container');
    if (!nav) return;
    nav.innerHTML = '';
    let tabs = [];
    if (role === 'cook') {
        tabs = [
            { id: 'shift-entry', label: t('myChecklist') },
            { id: 'cook-dashboard', label: t('shiftsCompleted') },
            { id: 'cook-training', label: t('trainingModules') },
            { id: 'recipe-book', label: t('recipeBook') }
        ];
    } else if (role === 'manager') {
        tabs = [
            { id: 'shift-entry', label: '📋 Shift Manager' },
            { id: 'manager-dashboard', label: t('managerDashboard') },
            { id: 'cook-training', label: t('trainingModules') },
            { id: 'recipe-book', label: t('recipeBook') },
            { id: 'roster', label: t('staffRoster') }
        ];
    } else if (role === 'gm') {
        tabs = [
            { id: 'gm-dashboard', label: t('gmSuite') },
            { id: 'shift-entry', label: '📋 Shift Manager' },
            { id: 'manager-dashboard', label: t('managerDashboard') },
            { id: 'cook-training', label: t('trainingModules') },
            { id: 'recipe-book', label: t('recipeBook') },
            { id: 'roster', label: t('staffRoster') }
        ];
    }
    tabs.forEach((tab, idx) => {
        const btn = document.createElement('button');
        btn.className = `tab-btn ${idx === 0 ? 'active' : ''}`;
        btn.textContent = tab.label;
        btn.onclick = () => switchTab(tab.id, btn);
        nav.appendChild(btn);
    });
    if (tabs.length > 0) switchTab(tabs[0].id, nav.firstChild);
}

function switchTab(viewId, btnEl) {
    document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`view-${viewId}`)?.classList.add('active');
    btnEl?.classList.add('active');
    UIController.refreshActiveView();
}

// ==========================================
// 5. RENDER CHECKLISTS, ASSIGNMENTS & DASHBOARDS
// ==========================================
function renderManagerChecklist() {
    const container = document.getElementById('checklist-container');
    if (!container) return;
    container.innerHTML = '';
    const banner = document.createElement('div');
    banner.className = 'card';
    banner.style.cssText = 'margin-bottom: 1.5rem; background: #f0fdf4; border: 1px solid #bbf7d0;';
    banner.innerHTML = `<h3 style="color: #166534; margin: 0;">📍 Shift Manager Operational Checklist</h3><p style="margin: 4px 0 0 0; font-size: 0.85rem; color: #15803d;">Daily shift management and verification standards.</p>`;
    container.appendChild(banner);
    let html = `<div class="card checklist-section"><h3 class="checklist-section-title" style="color:#1e3a8a; margin-bottom:0.75rem;">📋 Shift Manager Procedures</h3>`;
    MANAGER_STATIC_CHECKLIST.forEach(item => {
        html += `<div class="task-row" style="display:flex; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid #f1f5f9;"><input type="checkbox" class="task-checkbox" id="cb-${item.id}" style="width:20px;height:20px;cursor:pointer;"><div><div class="task-title" style="font-weight:600;color:#334155;">${item.title}</div><div class="task-desc" style="font-size:0.85rem; color:#64748b;">${item.desc}</div></div></div>`;
    });
    html += `</div>`;
    container.innerHTML += html;
    container.innerHTML += `<div style="margin-top: 1.5rem; display: flex; gap: 10px; align-items: center; flex-wrap: wrap;"><button class="btn btn-primary" onclick="submitManagerShiftChecklist()">💾 Submit Manager Shift Checklist</button></div>`;
}

// Gated Cook Checklist: Hidden until manager assigns a station/checklist
function renderCookChecklistGated() {
    const container = document.getElementById('checklist-container');
    if (!container) return;
    container.innerHTML = '';

    if (!Store.assignedStation || !Store.assignedChecklistKey) {
        container.innerHTML = `
            <div class="card" style="background: #fffbeb; border: 1px solid #fde68a; text-align: center; padding: 2.5rem;">
                <h3 style="color: #b45309; margin-top: 0;">👨‍🍳 Cook's Dashboard - Station Access Pending</h3>
                <p style="color: #92400e; font-size: 0.95rem;">No checklist or station has been assigned to you yet by a Manager or Shift Manager.</p>
                <p style="color: #78350f; font-size: 0.85rem;">Please contact your shift supervisor to assign your active opening or closing station.</p>
            </div>
        `;
        return;
    }

    const assignedKey = Store.assignedChecklistKey;
    const assignedTitle = Store.assignedStation;
    const specs = CHECKLIST_SPECS[Store.lang]?.[assignedKey] || CHECKLIST_SPECS['en'][assignedKey] || CHECKLIST_SPECS['en']['range_open'];

    const banner = document.createElement('div');
    banner.className = 'card';
    banner.style.cssText = 'margin-bottom: 1.5rem; background: #f0fdf4; border: 1px solid #bbf7d0;';
    banner.innerHTML = `<h3 style="color: #166534; margin: 0;">${t('assignedStationLabel')} ${assignedTitle}</h3><p style="margin:4px 0 0 0;font-size:0.85rem;color:#15803d;">${t('assignedStationSub')}</p>`;
    container.appendChild(banner);

    specs.forEach(sec => {
        let html = `<h3 class="checklist-section-title" style="color:#1e3a8a; margin-bottom:0.75rem;">${sec.phase}</h3>`;
        sec.tasks.forEach((task, idx) => {
            html += `<div class="task-row" style="display:flex; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid #f1f5f9;"><input type="checkbox" class="task-checkbox" id="cb-cook-${idx}" style="width:20px;height:20px;cursor:pointer;"><div><div class="task-title" style="font-weight:600; color:#334155;">${task.title}</div><div class="task-desc" style="font-size:0.85rem; color:#64748b;">${task.desc}</div></div></div>`;
        });
        container.innerHTML += `<div class="card checklist-section">${html}</div>`;
    });

    container.innerHTML += `<div style="margin-top: 1.5rem; display: flex; gap: 10px; align-items: center; flex-wrap: wrap;"><button class="btn btn-primary" onclick="submitCookShiftChecklist()">💾 Submit Completed Station Checklist</button></div>`;
}

function renderChecklists() {
    if (Store.role === 'manager' || Store.role === 'gm') { renderManagerChecklist(); return; }
    renderCookChecklistGated();
}

function submitCookShiftChecklist() {
    const cbs = document.querySelectorAll('.task-checkbox');
    const total = cbs.length;
    let checked = 0;
    cbs.forEach(cb => { if (cb.checked) checked++; });
    const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
    const shiftRecord = {
        id: `SHIFT-${Date.now()}`, empId: Store.user.id, empName: Store.user.name,
        role: Store.role, station: Store.assignedStation || 'Cook Station',
        date: new Date().toISOString().split('T')[0], tasksCompleted: checked,
        totalTasks: total, scorePct: pct, notes: pct >= 85 ? "Goal Met" : "Needs Improvement"
    };
    Store.shifts.push(shiftRecord);
    ApiService.request('saveShift', { shift: shiftRecord }).then(res => {
        alert(`🎉 Checklist submitted successfully! Score: ${pct}%`);
        Store.assignedStation = null;
        Store.assignedChecklistKey = null;
        switchTab('cook-dashboard', document.querySelector('.tab-btn'));
    });
}

function renderManagerAssignmentWidget() {
    const container = document.getElementById('manager-assignment-widget-container');
    if (!container) return;
    const selectedDateStr = document.getElementById('shift-date')?.value || new Date().toISOString().split('T')[0];
    container.innerHTML = `
        <div class="card" style="margin-bottom: 1.5rem; background: #f8fafc; border: 1px solid #cbd5e1;">
            <h3 style="color: #1e3a8a; margin-top: 0;">👥 Station & Shift Line Assignments</h3>
            <p style="font-size: 0.85rem; color: #64748b;">Schedule daily opening and closing line positions and assign cook checklists.</p>
            <div style="margin: 1rem 0;"><label style="font-weight: 600; font-size: 0.9rem;">Select Date:</label><input type="date" id="shift-date" class="form-control" value="${selectedDateStr}" onchange="renderManagerAssignmentWidget()" style="margin-top: 4px; max-width: 200px;"></div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-top: 1rem;">
                <div style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
                    <h4 style="color: #0369a1; margin-top: 0;">☀️ Morning Shift 2-Cook Split</h4>
                    <div style="margin-bottom: 8px;"><label style="font-size: 0.85rem; font-weight: bold;">Range / Mid-Split Open:</label><select id="sel-range_mid_split_open" class="form-control" style="width: 100%;"><option value="">-- Select Cook --</option>${Store.employees.map(e => `<option value="${e.id || e.ID}">${e.name || e.Name}</option>`).join('')}</select></div>
                    <div style="margin-bottom: 8px;"><label style="font-size: 0.85rem; font-weight: bold;">Grill/Fry / Mid-Split Open:</label><select id="sel-grill_fry_mid_split_open" class="form-control" style="width: 100%;"><option value="">-- Select Cook --</option>${Store.employees.map(e => `<option value="${e.id || e.ID}">${e.name || e.Name}</option>`).join('')}</select></div>
                    <button class="btn btn-primary" style="width: 100%; margin-top: 8px;" onclick="assignCooksGroup(['sel-range_mid_split_open', 'sel-grill_fry_mid_split_open'])">Assign Split Line 📌</button>
                </div>
                <div style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
                    <h4 style="color: #0369a1; margin-top: 0;">☀️ Morning 3-Cook Line & Stations</h4>
                    <div style="margin-bottom: 6px;"><label style="font-size: 0.85rem; font-weight: bold;">Range Open:</label><select id="sel-range_open" class="form-control" style="width: 100%;"><option value="">-- Select --</option>${Store.employees.map(e => `<option value="${e.id || e.ID}">${e.name || e.Name}</option>`).join('')}</select></div>
                    <div style="margin-bottom: 6px;"><label style="font-size: 0.85rem; font-weight: bold;">Mid Open:</label><select id="sel-mid_open" class="form-control" style="width: 100%;"><option value="">-- Select --</option>${Store.employees.map(e => `<option value="${e.id || e.ID}">${e.name || e.Name}</option>`).join('')}</select></div>
                    <div style="margin-bottom: 6px;"><label style="font-size: 0.85rem; font-weight: bold;">Grill/Fry Open:</label><select id="sel-grill_fry_open" class="form-control" style="width: 100%;"><option value="">-- Select --</option>${Store.employees.map(e => `<option value="${e.id || e.ID}">${e.name || e.Name}</option>`).join('')}</select></div>
                    <button class="btn btn-primary" style="width: 100%; margin-top: 4px;" onclick="assignCooksGroup(['sel-range_open', 'sel-mid_open', 'sel-grill_fry_open'])">Assign 3-Cook Line 📌</button>
                </div>
                <div style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
                    <h4 style="color: #c2410c; margin-top: 0;">🌙 Night Closing Line</h4>
                    <div style="margin-bottom: 8px;"><label style="font-size: 0.85rem; font-weight: bold;">Range / Mid-Split Close:</label><select id="sel-range_mid_split_close" class="form-control" style="width: 100%;"><option value="">-- Select Closer --</option>${Store.employees.map(e => `<option value="${e.id || e.ID}">${e.name || e.Name}</option>`).join('')}</select></div>
                    <div style="margin-bottom: 8px;"><label style="font-size: 0.85rem; font-weight: bold;">Grill/Fry / Mid-Split Close:</label><select id="sel-grill_fry_mid_split_close" class="form-control" style="width: 100%;"><option value="">-- Select Closer --</option>${Store.employees.map(e => `<option value="${e.id || e.ID}">${e.name || e.Name}</option>`).join('')}</select></div>
                    <button class="btn btn-primary" style="width: 100%; background: #c2410c; border-color: #c2410c; margin-top: 8px;" onclick="assignCooksGroup(['sel-range_mid_split_close', 'sel-grill_fry_mid_split_close'])">Assign Closing Line 📌</button>
                </div>
            </div>
        </div>`;
}

function assignCooksGroup(selectIds) {
    let assignedCount = 0;
    selectIds.forEach(id => {
        const selectEl = document.getElementById(id);
        if (!selectEl || !selectEl.value) return;
        const stationKey = id.replace('sel-', '');
        const empId = selectEl.value;
        const emp = Store.employees.find(e => String(e.id || e.ID).trim() === String(empId).trim());
        
        if (emp) {
            emp.station = stationKey;
            ApiService.request('saveEmployee', { employee: emp });
            
            // If the currently logged-in user is a cook and matches this assignment, update their live session state immediately
            if (Store.user && String(Store.user.id).trim() === String(emp.id).trim()) {
                Store.assignedChecklistKey = stationKey;
                Store.assignedStation = stationKey.replace(/_/g, ' ').toUpperCase();
            }
            assignedCount++;
        }
    });
    
    if (assignedCount > 0) {
        alert(`✅ Successfully assigned ${assignedCount} cook(s) with active checklists!`);
        // Refresh views if a manager dashboard is open
        if (typeof renderManagerAssignmentWidget === 'function') {
            renderManagerAssignmentWidget();
        }
    } else {
        alert("Please select at least one cook.");
    }
}

function submitManagerShiftChecklist() {
    const cbs = document.querySelectorAll('.task-checkbox');
    const total = cbs.length;
    let checked = 0;
    cbs.forEach(cb => { if (cb.checked) checked++; });
    const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
    const shiftRecord = {
        id: `SHIFT-${Date.now()}`, empId: Store.user.id, empName: Store.user.name,
        role: Store.role, station: Store.user.station || 'manager_checklist',
        date: new Date().toISOString().split('T')[0], tasksCompleted: checked,
        totalTasks: total, scorePct: pct, notes: pct >= 85 ? "Goal Met" : "Needs Improvement"
    };
    Store.shifts.push(shiftRecord);
    ApiService.request('saveShift', { shift: shiftRecord }).then(res => {
        alert(`🎉 Shift submitted! Score: ${pct}%`);
        switchTab('manager-dashboard', document.querySelector('.tab-btn'));
    });
}

function renderMessageBoard() {
    const container = document.getElementById('message-board-container');
    if (!container) return;
    const categories = ["Maintenance", "Injuries", "Customers", "Employees", "86 Items", "General"];
    let html = `<div class="card" style="margin-bottom: 1.5rem;"><h3 style="color: #1e3a8a; margin-top: 0;">💬 Management Message Board</h3><p style="font-size: 0.85rem; color: #64748b;">Post operational updates across categories.</p><form onsubmit="postMessage(event)" style="display: flex; flex-direction: column; gap: 10px; margin-top: 1rem;"><select id="msg-category" class="form-control" required><option value="">-- Select Channel --</option>${categories.map(c => `<option value="${c}">${c}</option>`).join('')}</select><textarea id="msg-text" class="form-control" rows="3" placeholder="Type operational update..." required></textarea><button type="submit" class="btn btn-primary" style="align-self: flex-start;">Post Message 📢</button></form></div><div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem;">`;
    categories.forEach(cat => {
        const catMessages = Store.messages.filter(m => String(m.category).trim().toLowerCase() === cat.toLowerCase());
        html += `<div class="card" style="background: #f8fafc; border: 1px solid #e2e8f0;"><h4 style="color: #1e3a8a; margin-top: 0; border-bottom: 2px solid #cbd5e1; padding-bottom: 6px;">📌 ${cat}</h4><div style="max-height:250px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;">${catMessages.length === 0 ? `<p style="font-size: 0.8rem; color: #94a3b8; font-style: italic;">No posts.</p>` : catMessages.map(m => `<div style="background: white; padding: 8px; border-radius: 4px; border: 1px solid #cbd5e1; font-size: 0.85rem;"><div style="display: flex; justify-content: space-between; font-weight: bold; color: #334155; margin-bottom: 4px;"><span>${m.authorName || 'Staff'}</span><span style="font-size:0.75rem;color:#94a3b8;">${m.timestamp || ''}</span></div><p style="margin: 0; color: #475569;">${m.messageText || m.text || ''}</p></div>`).join('')}</div></div>`;
    });
    html += `</div>`;
    container.innerHTML = html;
}

function postMessage(e) {
    e.preventDefault();
    if (!Store.user) return;
    const category = document.getElementById('msg-category').value;
    const messageText = document.getElementById('msg-text').value.trim();
    const payload = { id: `MSG-${Date.now()}`, category, authorName: Store.user.name, timestamp: new Date().toLocaleString(), messageText };
    Store.messages.push(payload);
    ApiService.request('saveMessage', { message: payload }).then(() => { document.getElementById('msg-text').value = ''; renderMessageBoard(); });
}

// ==========================================
// 6. ALPHABETIZED RECIPE BOOK (JUMP BAR & GM PERMISSIONS)
// ==========================================
let activeBookTab = 'recipes';
let activeAlphaFilter = 'ALL';

function renderRecipeBook() {
    const container = document.getElementById('recipe-book-container');
    if (!container) return;

    const isGM = Store.role === 'gm';
    const sortedRecipes = [...Store.recipes].filter(r => r.type !== 'prep').sort((a, b) => (a.menuItem || '').localeCompare(b.menuItem || ''));
    const sortedPrep = [...Store.recipes].filter(r => r.type === 'prep').sort((a, b) => (a.menuItem || '').localeCompare(b.menuItem || ''));
    const activeList = activeBookTab === 'recipes' ? sortedRecipes : sortedPrep;

    const filteredList = activeAlphaFilter === 'ALL' ? activeList : activeList.filter(r => (r.menuItem || r.title || '').toUpperCase().startsWith(activeAlphaFilter));
    const alphabet = ['ALL', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

    let html = `
        <div class="card" style="margin-bottom: 1.5rem; background: #f8fafc; border: 1px solid #cbd5e1;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 1rem;">
                <div>
                    <h3 style="color: #1e3a8a; margin: 0 0 4px 0;">📖 Recipe & Prep Spec Book</h3>
                    <p style="font-size: 0.85rem; color: #64748b; margin: 0;">Master alphabetized database (${isGM ? 'GM Full Access' : 'Read-Only Reference'}).</p>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn ${activeBookTab === 'recipes' ? 'btn-primary' : 'btn-secondary'}" onclick="setBookTab('recipes')">🍽️ Recipes (${sortedRecipes.length})</button>
                    <button class="btn ${activeBookTab === 'prep' ? 'btn-primary' : 'btn-secondary'}" onclick="setBookTab('prep')">📋 Prep Spec Sheets (${sortedPrep.length})</button>
                </div>
            </div>

            <!-- ALPHABET JUMP BAR -->
            <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 1rem; background: white; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1; justify-content: center;">
                ${alphabet.map(letter => `<button class="btn ${activeAlphaFilter === letter ? 'btn-primary' : 'btn-secondary'}" style="padding:4px 10px;font-size:0.8rem;min-width:32px;" onclick="setAlphaFilter('${letter}')">${letter}</button>`).join('')}
            </div>

            ${isGM ? `
                <div style="background: white; padding: 1rem; border-radius: 6px; border: 1px solid #e2e8f0; margin-top: 1rem;">
                    <h4 id="book-form-title" style="color: #1e3a8a; margin-top: 0;">➕ Add New ${activeBookTab === 'recipes' ? 'Recipe' : 'Prep Spec Sheet'}</h4>
                    <form onsubmit="handleInlineBookSubmit(event)" style="display: flex; flex-direction: column; gap: 10px;">
                        <input type="hidden" id="book-item-id" value="">
                        <input type="hidden" id="book-item-type" value="${activeBookTab}">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px;">
                            <input type="text" id="book-item-name" class="form-control" placeholder="Name" required>
                            <input type="text" id="book-item-category" class="form-control" placeholder="Category" required>
                            ${activeBookTab === 'recipes' ? `<input type="text" id="book-item-portions" class="form-control" placeholder="Portion Size"><input type="text" id="book-item-time-temp" class="form-control" placeholder="Time / Temp">` : ''}
                        </div>
                        ${activeBookTab === 'recipes' ? `<textarea id="book-item-ingredients" class="form-control" rows="2" placeholder="Ingredients"></textarea>` : ''}
                        <textarea id="book-item-details" class="form-control" rows="2" placeholder="Details" required></textarea>
                        <div style="display: flex; gap: 8px;">
                            <button type="submit" id="book-submit-btn" class="btn btn-primary">Save 💾</button>
                            <button type="button" id="book-cancel-btn" class="btn btn-secondary" style="display: none;" onclick="resetBookForm()">Cancel ❌</button>
                        </div>
                    </form>
                </div>
            ` : ''}
        </div>
        <div style="display: flex; flex-direction: column; gap: 1rem;">
    `;

    if (filteredList.length === 0) {
        html += `<div class="card"><p style="color: #64748b; font-style: italic;">No items found for letter "${activeAlphaFilter}".</p></div>`;
    } else {
        filteredList.forEach(r => {
            const rId = r.id || r.ID || r.menuItem;
            const itemName = r.menuItem || r.title || '';
            html += `
                <div class="card" style="border-left: 4px solid #1e3a8a;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px;">
                        <h4 style="color: #1e3a8a; margin: 0 0 6px 0;">🍽️ ${itemName} <span style="font-size:0.8rem;background:#e0f2fe;color:#0369a1;padding:2px 6px;border-radius:4px;">${r.category || 'General'}</span></h4>
                        ${isGM ? `
                            <div style="display: flex; gap: 6px;">
                                <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.8rem;" onclick="modifyRecipe('${rId}')">Modify ✏️</button>
                                <button class="btn btn-secondary" style="color: #dc2626; padding: 4px 8px; font-size: 0.8rem;" onclick="deleteRecipe('${rId}')">Delete 🗑️</button>
                            </div>
                        ` : ''}
                    </div>
                    ${r.type === 'recipes' || !r.type ? `
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin: 8px 0; font-size: 0.9rem; background: #f8fafc; padding: 8px; border-radius: 4px;">
                            ${r.portionSize ? `<div><strong>Portion:</strong> ${r.portionSize}</div>` : ''}
                            ${r.cookTimeTemp ? `<div><strong>Time/Temp:</strong> ${r.cookTimeTemp}</div>` : ''}
                        </div>
                        ${r.ingredients ? `<p style="font-size: 0.9rem; color: #334155; margin: 6px 0;"><strong>Ingredients:</strong> ${r.ingredients}</p>` : ''}
                    ` : ''}
                    <p style="font-size: 0.9rem; color: #334155; margin-bottom: 0;"><strong>Details:</strong> ${r.prepSpecs || r.buildDetails || r.details || ''}</p>
                </div>
            `;
        });
    }
    html += `</div>`;
    container.innerHTML = html;
}

function setBookTab(tab) { activeBookTab = tab; activeAlphaFilter = 'ALL'; resetBookForm(); renderRecipeBook(); }
function setAlphaFilter(letter) { activeAlphaFilter = letter; renderRecipeBook(); }

function resetBookForm() {
    const idEl = document.getElementById('book-item-id');
    if (!idEl) return;
    idEl.value = '';
    document.getElementById('book-item-name').value = '';
    document.getElementById('book-item-category').value = '';
    document.getElementById('book-item-details').value = '';
    if (document.getElementById('book-item-ingredients')) document.getElementById('book-item-ingredients').value = '';
    if (document.getElementById('book-item-portions')) document.getElementById('book-item-portions').value = '';
    if (document.getElementById('book-item-time-temp')) document.getElementById('book-item-time-temp').value = '';
    document.getElementById('book-form-title').textContent = `➕ Add New ${activeBookTab === 'recipes' ? 'Recipe' : 'Prep Spec Sheet'}`;
    document.getElementById('book-submit-btn').textContent = 'Save 💾';
    document.getElementById('book-cancel-btn').style.display = 'none';
}

function modifyRecipe(recId) {
    if (Store.role !== 'gm') return;
    const item = Store.recipes.find(r => String(r.id || r.ID || r.menuItem).trim() === String(recId).trim());
    if (!item) return;
    activeBookTab = item.type || 'recipes';
    renderRecipeBook();
    document.getElementById('book-item-id').value = item.id || item.ID || recId;
    document.getElementById('book-item-name').value = item.menuItem || item.title || '';
    document.getElementById('book-item-category').value = item.category || '';
    document.getElementById('book-item-details').value = item.prepSpecs || item.buildDetails || item.details || '';
    if (document.getElementById('book-item-ingredients')) document.getElementById('book-item-ingredients').value = item.ingredients || '';
    if (document.getElementById('book-item-portions')) document.getElementById('book-item-portions').value = item.portionSize || '';
    if (document.getElementById('book-item-time-temp')) document.getElementById('book-item-time-temp').value = item.cookTimeTemp || '';
    document.getElementById('book-form-title').textContent = `✏️ Modify: ${item.menuItem || item.title}`;
    document.getElementById('book-submit-btn').textContent = 'Update Item 💾';
    document.getElementById('book-cancel-btn').style.display = 'inline-block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleInlineBookSubmit(e) {
    e.preventDefault();
    if (Store.role !== 'gm') return;
    const itemId = document.getElementById('book-item-id').value;
    const type = document.getElementById('book-item-type').value;
    const recipeObj = {
        id: itemId || `BOOK-${Date.now()}`, type,
        menuItem: document.getElementById('book-item-name').value.trim(),
        category: document.getElementById('book-item-category').value.trim(),
        prepSpecs: type === 'prep' ? document.getElementById('book-item-details').value.trim() : '',
        buildDetails: type === 'recipes' ? document.getElementById('book-item-details').value.trim() : '',
        ingredients: type === 'recipes' ? (document.getElementById('book-item-ingredients')?.value.trim() || '') : '',
        portionSize: type === 'recipes' ? (document.getElementById('book-item-portions')?.value.trim() || '') : '',
        cookTimeTemp: type === 'recipes' ? (document.getElementById('book-item-time-temp')?.value.trim() || '') : ''
    };
    if (itemId) {
        const index = Store.recipes.findIndex(r => String(r.id || r.menuItem).trim() === String(itemId).trim());
        if (index > -1) Store.recipes[index] = recipeObj; else Store.recipes.push(recipeObj);
    } else { Store.recipes.push(recipeObj); }
    ApiService.request('saveRecipe', { recipe: recipeObj }).then(() => { resetBookForm(); renderRecipeBook(); });
}

function deleteRecipe(recId) {
    if (Store.role !== 'gm') return;
    if (!confirm("Delete item?")) return;
    Store.recipes = Store.recipes.filter(r => String(r.id || r.menuItem).trim() !== String(recId).trim());
    renderRecipeBook();
}

function renderTrainingView() {
    const listContainer = document.getElementById('training-modules-list');
    if (!listContainer) return;
    let html = '';
    TRAINING_MODULES.forEach(mod => {
        const userCert = Store.certifications.find(c => String(c.empId || c.EMPID).trim() === String(Store.user.id).trim() && String(c.modId || c.MODID).trim() === String(mod.id).trim());
        const passed = userCert && (userCert.passed === true || String(userCert.passed).toLowerCase() === 'true' || Number(userCert.score) >= 85);
        const signedOff = userCert && (userCert.managerSignOff === true || String(userCert.managerSignOff).toLowerCase() === 'true');
        html += `<div class="card" style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;"><div><h4 style="color: #1e3a8a; margin: 0 0 4px 0;">${mod.id}: ${mod.title}</h4><p style="font-size: 0.85rem; color: #64748b; margin: 0;">${mod.description}</p><div style="margin-top: 8px; font-size: 0.85rem; font-weight: 600;">Status: ${passed ? (signedOff ? '✅ Certified & Signed Off' : '⏳ Passed (Pending GM Sign-Off)') : '❌ Not Completed'} (Passing: 85%+)</div></div><button class="btn btn-primary" onclick="openQuizModal('${mod.id}')">${passed ? 'Retake Quiz 📝' : 'Take Quiz 🚀'}</button></div>`;
    });
    listContainer.innerHTML = html;
}

function openQuizModal(modId) {
    const mod = TRAINING_MODULES.find(m => m.id === modId);
    if (!mod) return;
    document.getElementById('quiz-modal-title').textContent = mod.title;
    const body = document.getElementById('quiz-modal-body');
    body.innerHTML = `<input type="hidden" id="active-mod-id" value="${mod.id}"><p style="color:#64748b;font-size:0.9rem;">${mod.description} (Requires 85% to pass)</p>${mod.questions.map((qObj, idx) => `<div style="margin-bottom: 1rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.75rem;"><p style="font-weight: 600; color: #1e3a8a;">${idx + 1}. ${qObj.q}</p>${qObj.options.map((opt, oIdx) => `<label style="display: block; margin-bottom: 4px; font-size: 0.9rem; cursor: pointer;"><input type="radio" name="q-${idx}" value="${oIdx}"> ${opt}</label>`).join('')}</div>`).join('')}`;
    document.getElementById('quiz-modal').style.display = 'flex';
}

function closeQuizModal() { document.getElementById('quiz-modal').style.display = 'none'; }

function submitQuizAnswers() {
    const modId = document.getElementById('active-mod-id').value;
    const mod = TRAINING_MODULES.find(m => m.id === modId);
    if (!mod) return;
    let correctCount = 0;
    mod.questions.forEach((qObj, idx) => {
        const selected = document.querySelector(`input[name="q-${idx}"]:checked`);
        if (selected && Number(selected.value) === qObj.correct) correctCount++;
    });
    const score = Math.round((correctCount / mod.questions.length) * 100);
    const passed = score >= 85;
    const certRecord = { empId: Store.user.id, modId: mod.id, score, passed, managerSignOff: false };
    Store.certifications.push(certRecord);
    ApiService.request('saveCert', { cert: certRecord }).then(() => {
        closeQuizModal();
        alert(`Quiz submitted! Score: ${score}% (${passed ? '✅ Passed' : '❌ Failed'})`);
        renderTrainingView();
        updateGreetingLabel();
    });
}

function isCertifiedTeamLeader(empId) {
    const empCerts = Store.certifications.filter(c => String(c.empId || c.EMPID || '').trim() === String(empId).trim());
    if (empCerts.length < TRAINING_MODULES.length) return false;
    return empCerts.every(rec => {
        const passed = rec.passed === true || String(rec.passed).toLowerCase() === 'true' || Number(rec.score) >= 85;
        const signed = rec.managerSignOff === true || String(rec.managerSignOff).toLowerCase() === 'true';
        return passed && signed;
    });
}

function renderCookDashboard() {
    const container = document.getElementById('cook-dashboard-content');
    if (!container) return;
    const myShifts = Store.shifts.filter(s => String(s.empId).trim() === String(Store.user.id).trim());
    let rowsHtml = myShifts.length === 0 ? `<tr><td colspan="5" style="text-align: center; color: #64748b;">${t('noShifts')}</td></tr>` :
        myShifts.map(s => `<tr><td>${s.date}</td><td>${s.station || 'General'}</td><td>${s.tasksCompleted} / ${s.totalTasks}</td><td>${s.scorePct}%</td><td>${Number(s.scorePct) >= 85 ? t('goalMet') : t('missed')}</td></tr>`).join('');

    container.innerHTML = `
        <div class="card" style="margin-bottom: 1.5rem;"><h3 style="color: #1e3a8a; margin-top: 0;">${t('cookDashTitle')}</h3><p style="font-size: 0.85rem; color: #64748b;">${t('cookDashSub')}</p></div>
        <div class="card"><table class="data-table" style="width: 100%;"><thead><tr><th>${t('tblDate')}</th><th>${t('tblStation')}</th><th>${t('tblCompletedTasks')}</th><th>${t('tblScore')}</th><th>${t('tblStatus')}</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
}

// Manager & General Manager Shift Manager Tab with Calendar Lookup for Completed Shifts
function renderManagerDashboard() {
    const container = document.getElementById('manager-dashboard-content');
    if (!container) return;

    // Filter shifts based on calendar lookup date
    const lookupDate = Store.selectedShiftDate;
    const filteredShifts = Store.shifts.filter(s => String(s.date).trim() === String(lookupDate).trim());

    container.innerHTML = `
        <div class="card" style="margin-bottom: 1.5rem;">
            <h3 style="color: #1e3a8a; margin-top: 0;">📊 Shift Manager Dashboard & Oversight</h3>
            <p style="font-size: 0.85rem; color: #64748b;">Assign line positions and review completed employee shift reports.</p>
        </div>
        <div id="manager-assignment-widget-container"></div>
        <div class="card" style="margin-top: 1.5rem; margin-bottom: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 1rem;">
                <h4 style="color: #1e3a8a; margin: 0;">⭐ Completed Team Shifts & Reports</h4>
                <div>
                    <label style="font-weight: 600; font-size: 0.85rem; margin-right: 6px;">Lookup Date:</label>
                    <input type="date" id="gm-calendar-lookup-date" class="form-control" value="${lookupDate}" onchange="handleShiftCalendarLookup(this.value)" style="display: inline-block; width: auto; margin-bottom: 0;">
                </div>
            </div>
            <table class="data-table" style="width: 100%; margin-top: 1rem;">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Employee</th>
                        <th>Role</th>
                        <th>Station / Shift Type</th>
                        <th>Score</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredShifts.length === 0 ? `<tr><td colspan="6" style="text-align: center; color: #64748b;">No completed shift records found for ${lookupDate}.</td></tr>` : filteredShifts.map(s => `<tr><td>${s.date}</td><td><strong>${s.empName}</strong></td><td>${String(s.role || '').toUpperCase()}</td><td>${s.station || 'General'}</td><td>${s.scorePct}%</td><td>${Number(s.scorePct) >= 85 ? '✅ Goal Met' : '❌ Missed'}</td></tr>`).join('')}
                </tbody>
            </table>
        </div>
        <div id="message-board-container"></div>`;
    renderMessageBoard();
    renderManagerAssignmentWidget();
}

function handleShiftCalendarLookup(dateVal) {
    Store.selectedShiftDate = dateVal;
    renderManagerDashboard();
}

function renderGMDashboard() {
    const container = document.getElementById('gm-dashboard-content');
    if (!container) return;
    const pendingCerts = Store.certifications.filter(c => {
        const passed = c.passed === true || String(c.passed).toLowerCase() === 'true' || Number(c.score) >= 85;
        const signed = c.managerSignOff === true || String(c.managerSignOff).toLowerCase() === 'true';
        return passed && !signed;
    });
    const startDate = new Date(CONFIG.PROGRAM_START_DATE);
    const endDate = new Date(startDate); endDate.setDate(endDate.getDate() + 13);
    const cycleShifts = Store.shifts.filter(s => { const d = new Date(s.date); return d >= startDate && d <= endDate; });
    const dailyCompliance = {};
    for (let i = 0; i < 14; i++) {
        const curr = new Date(startDate); curr.setDate(curr.getDate() + i);
        dailyCompliance[curr.toISOString().split('T')[0]] = { total: 0, sum: 0 };
    }
    cycleShifts.forEach(s => { if (dailyCompliance[s.date]) { dailyCompliance[s.date].total += 1; dailyCompliance[s.date].sum += Number(s.scorePct || 0); } });

    const employeeAverages = {};
    Store.employees.forEach(emp => {
        const eId = emp.id || emp.ID;
        const eShifts = cycleShifts.filter(s => String(s.empId).trim() === String(eId).trim());
        if (eShifts.length > 0) {
            const totalScore = eShifts.reduce((acc, s) => acc + Number(s.scorePct || 0), 0);
            employeeAverages[eId] = { name: emp.name || emp.Name, avg: Math.round(totalScore / eShifts.length), shiftsCount: eShifts.length };
        }
    });

    let bronzeCount = 0, silverCount = 0, goldCount = 0;
    const accountingRows = [];
    Object.values(employeeAverages).forEach(data => {
        let tier = 'None';
        if (data.avg >= 100) { tier = 'Gold 🥇'; goldCount++; }
        else if (data.avg >= 95) { tier = 'Silver 🥈'; silverCount++; }
        else if (data.avg >= 85) { tier = 'Bronze 🥉'; bronzeCount++; }
        if (tier !== 'None') { accountingRows.push(`<tr><td><strong>${data.name}</strong></td><td>${data.shiftsCount}</td><td>${data.avg}%</td><td><span style="font-weight:bold;color:#1e3a8a;">${tier}</span></td></tr>`); }
    });

    const lookupDate = Store.selectedShiftDate;
    const filteredShifts = Store.shifts.filter(s => String(s.date).trim() === String(lookupDate).trim());

    container.innerHTML = `
        <div class="card" style="margin-bottom: 1.5rem;"><h3 style="color: #1e3a8a; margin-top: 0;">📈 General Manager Executive Suite & Bonus Program</h3><p style="font-size: 0.85rem; color: #64748b;">14-Day compliance tracking cycle.</p></div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
            <div class="card" style="text-align: center;"><span style="font-size: 0.85rem; color: #64748b;">Active Team Members</span><h2 style="color: #1e3a8a; margin: 5px 0 0 0;">${Store.employees.length}</h2></div>
            <div class="card" style="text-align: center;"><span style="font-size: 0.85rem; color: #64748b;">Total Shifts Logged (Cycle)</span><h2 style="color: #1e3a8a; margin: 5px 0 0 0;">${cycleShifts.length}</h2></div>
            <div class="card" style="text-align: center;"><span style="font-size: 0.85rem; color: #64748b;">Pending Cert Sign-Offs</span><h2 style="color: #dc2626; margin: 5px 0 0 0;">${pendingCerts.length}</h2></div>
        </div>
        <div class="card" style="margin-bottom: 1.5rem;"><h4 style="color: #1e3a8a; margin-top: 0;">📊 14-Day Compliance Tracking Trend</h4>
            <div style="display: flex; gap: 6px; align-items: flex-end; height: 180px; padding: 20px 10px 10px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; overflow-x: auto; margin-top: 1rem;">
                ${Object.entries(dailyCompliance).map(([date, stats]) => {
                    const avg = stats.total > 0 ? Math.round(stats.sum / stats.total) : 0;
                    return `<div style="flex: 1; display: flex; flex-direction: column; align-items: center; min-width: 35px; height: 100%; justify-content: flex-end;"><span style="font-size: 0.7rem; font-weight: bold; color: #1e3a8a; margin-bottom: 4px;">${avg}%</span><div style="width: 100%; background: #2563eb; border-radius: 4px 4px 0 0; height: Math.max(avg,5)%;"></div><span style="font-size:0.65rem;color:#64748b;margin-top:6px;transform:rotate(-35deg);">${date.slice(5)}</span></div>`;
                }).join('')}
            </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-bottom: 1.5rem;">
            <div class="card"><h4 style="color: #1e3a8a; margin-top: 0;">🥧 Bonus Tier Allocation Distribution</h4>
                <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 1.5rem;">
                    <div style="background: #f8fafc; padding: 10px; border-radius: 6px; border-left: 4px solid #ca8a04;"><div style="display: flex; justify-content: space-between; font-weight: bold;"><span>Gold Tier (100%):</span> <span>${goldCount} Employee(s)</span></div></div>
                    <div style="background: #f8fafc; padding: 10px; border-radius: 6px; border-left: 4px solid #64748b;"><div style="display: flex; justify-content: space-between; font-weight: bold;"><span>Silver Tier (95%+):</span> <span>${silverCount} Employee(s)</span></div></div>
                    <div style="background: #f8fafc; padding: 10px; border-radius: 6px; border-left: 4px solid #b45309;"><div style="display: flex; justify-content: space-between; font-weight: bold;"><span>Bronze Tier (85%+):</span> <span>${bronzeCount} Employee(s)</span></div></div>
                </div>
            </div>
            <div class="card"><h4 style="color: #1e3a8a; margin-top: 0;">📑 Bonus Program Accounting Sheet</h4>
                <div style="max-height: 240px; overflow-y: auto; margin-top: 1rem;"><table class="data-table" style="width: 100%;"><thead><tr><th>Employee</th><th>Shifts</th><th>Avg Score</th><th>Tier</th></tr></thead><tbody>${accountingRows.length === 0 ? `<tr><td colspan="4" style="text-align: center; color: #64748b;">No employees have met thresholds.</td></tr>` : accountingRows.join('')}</tbody></table></div>
            </div>
        </div>
        <div id="manager-assignment-widget-container" style="margin-bottom: 1.5rem;"></div>
        <div class="card" style="margin-bottom: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 1rem;">
                <h4 style="color: #1e3a8a; margin: 0;">⭐ Completed Team Shifts & Reports</h4>
                <div>
                    <label style="font-weight: 600; font-size: 0.85rem; margin-right: 6px;">Lookup Date:</label>
                    <input type="date" id="gm-calendar-lookup-date" class="form-control" value="${lookupDate}" onchange="handleShiftCalendarLookup(this.value)" style="display: inline-block; width: auto; margin-bottom: 0;">
                </div>
            </div>
            <table class="data-table" style="width: 100%; margin-top: 1rem;">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Employee</th>
                        <th>Role</th>
                        <th>Station / Shift Type</th>
                        <th>Score</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredShifts.length === 0 ? `<tr><td colspan="6" style="text-align: center; color: #64748b;">No completed shift records found for ${lookupDate}.</td></tr>` : filteredShifts.map(s => `<tr><td>${s.date}</td><td><strong>${s.empName}</strong></td><td>${String(s.role || '').toUpperCase()}</td><td>${s.station || 'General'}</td><td>${s.scorePct}%</td><td>${Number(s.scorePct) >= 85 ? '✅ Goal Met' : '❌ Missed'}</td></tr>`).join('')}
                </tbody>
            </table>
        </div>
        <div class="card" style="margin-bottom: 1.5rem;"><h4 style="color: #1e3a8a; margin-top: 0;">🎓 Pending Training Certifications for Approval</h4>
            <table class="data-table" style="width: 100%; margin-top: 1rem;"><thead><tr><th>Employee ID</th><th>Module ID</th><th>Score</th><th>Action</th></tr></thead>
                <tbody>${pendingCerts.length === 0 ? `<tr><td colspan="4" style="text-align: center; color: #64748b;">No pending certifications.</td></tr>` : pendingCerts.map(c => `<tr><td>${c.empId || c.EMPID}</td><td>${c.modId || c.MODID}</td><td>${c.score}%</td><td><button class="btn btn-primary" style="padding: 4px 10px; font-size: 0.8rem;" onclick="gmSignOffCert('${c.empId || c.EMPID}','${c.modId || c.MODID}')">Approve ✅</button></td></tr>`).join('')}</tbody></table>
        </div>`;
    renderManagerAssignmentWidget();
}

function gmSignOffCert(empId, modId) {
    const cert = Store.certifications.find(c => String(c.empId || c.EMPID).trim() === String(empId).trim() && String(c.modId || c.MODID).trim() === String(modId).trim());
    if (!cert) return;
    cert.managerSignOff = true;
    ApiService.request('saveCert', { cert }).then(() => { renderGMDashboard(); alert("Certification approved!"); });
}

// Staff Roster View with Add/Edit/Delete & Strict De-Duplication Safeguards
function renderRosterView() {
    const tbody = document.getElementById('roster-table-body');
    if (!tbody) return;
    const uniqueEmployees = Array.from(new Map(Store.employees.map(emp => [String(emp.id || emp.ID).trim(), emp])).values());
    tbody.innerHTML = uniqueEmployees.length === 0 ? `<tr><td colspan="6" style="text-align: center; color: #64748b;">No employees found.</td></tr>` :
        uniqueEmployees.map(emp => {
            const eId = emp.id || emp.ID;
            return `<tr><td>${eId}</td><td><strong>${emp.name || emp.Name}</strong></td><td>${String(emp.role || emp.Role || 'cook').toUpperCase()}</td><td>${emp.station || emp.Station || 'General'}</td><td>$${emp.hourlyRate || emp.HourlyRate || '0.00'}</td><td>${Store.role === 'gm' ? `<div style="display: flex; gap: 6px;"><button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.8rem;" onclick="openEmployeeModal('${eId}')">Edit ✏️</button><button class="btn btn-secondary" style="color: #dc2626; padding: 4px 8px; font-size: 0.8rem;" onclick="deleteEmployee('${eId}')">Delete 🗑️</button></div>` : ''}</td></tr>`;
        }).join('');
}

function openEmployeeModal(empId) {
    if (Store.role !== 'gm') return;
    let existing = null;
    if (empId) { existing = Store.employees.find(e => String(e.id || e.ID).trim() === String(empId).trim()); }
    const name = prompt("Enter employee name:", existing ? (existing.name || existing.Name || '') : '');
    if (!name) return;

    // Strict uniqueness check by name across existing roster to prevent duplication
    const normalizedName = name.trim().toLowerCase();
    const duplicateMatch = Store.employees.find(e =>
        (e.name || e.Name || '').trim().toLowerCase() === normalizedName &&
        String(e.id || e.ID).trim() !== String(empId || '').trim()
    );
    if (duplicateMatch) {
        alert(`❌ Error: An employee named "${name}" already exists in the staff roster (ID: ${duplicateMatch.id || duplicateMatch.ID}). Duplicate records are not permitted.`);
        return;
    }

    const role = prompt("Enter role (cook, manager, gm):", existing ? (existing.role || existing.Role || 'cook') : 'cook');
    const pin = prompt("Enter 4-digit PIN code:", existing ? (existing.pin || existing.PIN || '1234') : '1234');
    const station = prompt("Enter default station:", existing ? (existing.station || existing.Station || 'range_open') : 'range_open');
    const hourlyRate = prompt("Enter hourly rate:", existing ? (existing.hourlyRate || existing.HourlyRate || '18.00') : '18.00');

    const empObj = { id: existing ? (existing.id || existing.ID) : `EMP-${Date.now()}`, name: name.trim(), role, station, hourlyRate, pin, active: true };
    if (existing) {
        const index = Store.employees.findIndex(e => String(e.id || e.ID).trim() === String(empId).trim());
        if (index > -1) Store.employees[index] = empObj; else Store.employees.push(empObj);
    } else { Store.employees.push(empObj); }

    ApiService.request('saveEmployee', { employee: empObj }).then(() => { alert("Employee saved successfully!"); renderRosterView(); });
}

function deleteEmployee(empId) {
    if (Store.role !== 'gm') return;
    if (!confirm("Remove this employee?")) return;
    Store.employees = Store.employees.filter(e => String(e.id || e.ID).trim() !== String(empId).trim());
    renderRosterView();
}

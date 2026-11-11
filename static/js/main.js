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
    approvals: [],
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
        loadGlobalAppData();
    }
};

const UIController = {
    init() {
        const today = new Date().toISOString().split('T')[0];
        ['shift-date', 'cook-shift-date', 'gm-calendar-lookup-date', 'manager-calendar-lookup-date'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = today;
        });
        loadGlobalAppData();
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
        }
        if (id === 'gm-dashboard') {
            renderGMDashboard();
        }
        if (id === 'cook-training') renderTrainingView();
        if (id === 'recipe-book') renderRecipeBook();
        if (id === 'roster') renderRosterView();
    }
};
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

const MANAGER_STATIC_CHECKLIST = [
    { id: "mgr_1", title: "Verify opening HACCP temperature logs", desc: "Ensure all refrigeration and line holding logs are initialized and within safe thresholds." },
    { id: "mgr_2", title: "Review daily labor schedule and station assignments", desc: "Confirm all opening and closing stations are assigned and staffed appropriately." },
    { id: "mgr_3", title: "Inspect line cleanliness and sanitizer bucket ppm levels", desc: "Check quat solution concentration (200-400 ppm) across all prep and line stations." },
    { id: "mgr_4", title: "Verify walk-in cooler and freezer holding temperatures", desc: "Inspect compressor gauges and internal probe temperatures." },
    { id: "mgr_5", title: "Review morning communication log with shift leads", desc: "Discuss expected volume, special catering events, and 86'd items." }
];

const CHECKLIST_SPECS = {
    range_open: {
        title: { en: "Range Open Checklist", es: "Lista de Apertura de Estufa" },
        items: {
            en: [
                "Turn on all equipment including both ovens, the waffle iron(s), meat grill, pancake grill, fryolators (set to 350), and the exhaust system.",
                "Check Traulsen for stock on omelette fills, cheese, apples, waffle batter, and German batter.",
                "Season all pans as needed.",
                "Season meat grill and place all utensils out for the range/egg station.",
                "Check all bread stock in the egg station.",
                "Perform minor line prep as needed (i.e. diced veggies, meat, apples, wrap cheese).",
                "Check and calibrate all oven and grill temps.",
                "Set up sanitizing buckets with a quat solution (200-400 ppm) for the egg station.",
                "Sanitize all station cutting boards and prep surfaces.",
                "Set up a poached water pan and veggie water pan.",
                "Verify HACCP temperature logs are initialized for the morning shift.",
                "Ensure the handwash sink is clean and stocked.",
                "Check thaw pull for all daily line items is completed.",
                "End of shift - scrub and clean all stainless, restock Traulsen, egg-side bread and cold table.",
                "End of shift - clean range top, ovens, and meat grill."
            ],
            es: [
                "Encienda todo el equipo, incluidos ambos hornos, wafflera(s), parrilla de carne, parrilla de panqueques, freidoras (ajustadas a 350) y el sistema de extracción.",
                "Revise el Traulsen para verificar el inventario de rellenos para tortilla, queso, manzanas, masa para waffles y masa alemana.",
                "Sazone todas las cacerolas según sea necesario.",
                "Sazone la parrilla de carne y coloque todos los utensilios en la estación de huevos y estufa.",
                "Revise todo el inventario de pan en la estación de huevos.",
                "Realice la preparación menor de línea según sea necesario (ej. verduras picadas, carne, manzanas, envolver queso).",
                "Revise y calibre todas las temperaturas de hornos y parrillas.",
                "Prepare cubos desinfectantes con solución cuaternaria (200-400 ppm) para la estación de huevos.",
                "Desinfecte todas las tablas de cortar y superficies de preparación de la estación.",
                "Prepare la bandeja de agua para huevos pochados y la bandeja de agua para verduras.",
                "Verifique que los registros de temperatura HACCP estén inicializados para el turno de la mañana.",
                "Asegúrese de que el lavamanos esté limpio y abastecido.",
                "Verifique que se haya completado el descongelamiento de todos los artículos diarios de la línea.",
                "Fin de turno - Talle y limpie todo el acero inoxidable, reabastezca el Traulsen, pan del lado de huevos y mesa fría.",
                "Fin de turno - Limpie la parte superior de la estufa, los hornos y la parrilla de carne."
            ]
        }
    },
    mid_open: {
        title: { en: "Mid Open Checklist", es: "Lista de Apertura de Media Línea" },
        items: {
            en: [
                "Set up the cold table ensuring all meats, batters, veggies, and cheeses are stocked.",
                "Make back-up French toast and crepe batter as needed.",
                "Check stock for all bread on the grill side (English muffins, French toast, and muffins).",
                "Fill the steam table half-way with water and plug it in to turn it on.",
                "Set the steam table with 12 hot hold plastic pans.",
                "Bring all items for service in the steam table to a minimum internal temperature of 131 degrees Fahrenheit (Hot hold only, NOT for heating!). Transfer to new pans in the table.",
                "Place all correct utensils in the cold table and steam table ready for service.",
                "Inspect intermediate prep cooler temperatures to ensure they hold safely between 34°F and 38°F.",
                "Check backup inventory in the walk-in cooler to estimate afternoon rush volume.",
                "Restock squeeze bottles, portion cups, and smallwares.",
                "Stock plates, bowls, and to-go containers near the pass-through window.",
                "Verify the sanitation towel bucket is active and clean.",
                "Ensure the POS printer is operational with good ink and paper.",
                "End of shift - Flip all pans on the cold table. Restock and clean top and inside the cold table.",
                "End of shift - Restock all bread on fry side and all items in the steam table as necessary."
            ],
            es: [
                "Prepare la mesa fría asegurándose de que todas las carnes, masas, verduras y quesos estén abastecidos.",
                "Prepare masa adicional para pan francés y crepas según sea necesario.",
                "Revise el inventario de todo el pan en el lado de la plancha (muffins ingleses, pan francés y muffins).",
                "Llene la mesa de vapor hasta la mitad con agua y conéctela para encenderla.",
                "Coloque 12 bandejas de plástico de mantenimiento caliente en la mesa de vapor.",
                "Lleve todos los artículos de servicio en la mesa de vapor a una temperatura interna mínima de 131 grados Fahrenheit (Solo mantenimiento caliente, ¡NO para calentar!). Transfiera a bandejas nuevas en la mesa.",
                "Coloque todos los utensilios correctos en la mesa fría y la mesa de vapor listos para el servicio.",
                "Inspeccione las temperaturas del refrigerador de preparación intermedio para asegurarse de que se mantengan de manera segura entre 34°F y 38°F.",
                "Revise el inventario de respaldo en el refrigerador de almacenamiento (walk-in) para estimar el volumen de la hora pico de la tarde.",
                "Reabastezca botellas exprimibles, recipientes para porciones y utensilios pequeños.",
                "Abastezca platos, tazones y recipientes para llevar cerca de la ventana de salida.",
                "Verifique que el cubo de toallas sanitizantes esté activo y limpio.",
                "Asegúrese de que la impresora del POS funcione correctamente con suficiente tinta y papel.",
                "Fin de turno - Voltee todas las bandejas en la mesa fría. Reabastezca y limpie la parte superior e interior de la mesa fría.",
                "Fin de turno - Reabastezca todo el pan en el lado de freidoras y todos los artículos en la mesa de vapor según sea necesario."
            ]
        }
    },
    grill_fry_open: {
        title: { en: "Grill/Fry Open Checklist", es: "Lista de Apertura de Parrilla y Freidora" },
        items: {
            en: [
                "Set up the grill with ready to fire sausage and bacon, set up backup bacon and sausage.",
                "Cook sausage if necessary based on expected volume of business.",
                "Place a batter bucket out with a 6th pan spacer and 1/4 full of ice by the grill-side bread station.",
                "Place the pancake batter bucket inside with a large pancake ladle and cover on top.",
                "Check the fryolator side low-boy freezer for necessary re-stock.",
                "Set-up the three bay batter system for chicken tenders and the wet batter bucket for haddock.",
                "Check the fryolator oil for quality. If it is black or smoking, it must be changed prior to your shift start!.",
                "Check the upper bread shelf for burger buns, hot dog buns, sub rolls, and tortillas, and restock if necessary.",
                "Inspect oil levels and verify temperature controllers are set to 350°F.",
                "Scrape the flat-top griddle surface clean and apply high-temp cooking oil to season heating zones.",
                "Check grease traps and ensure clean drip pans are in place.",
                "Stock low-boy freezer with french fries, chicken, and mac and cheese within arm's reach.",
                "Review expected volume sheets with the morning kitchen lead.",
                "End of shift - Check the low boy freezer for re-stock and stock accordingly.",
                "End of shift - Clean the grill, including the control panel and shelves, Empty the greasetrap."
            ],
            es: [
                "Prepare la parrilla con salchicha y tocino listos para cocinar, y prepare respaldo de tocino y salchicha.",
                "Cocine salchicha si es necesario según el volumen esperado de negocio.",
                "Coloque un cubo de masa con un espaciador de bandeja 1/6 y 1/4 lleno de hielo junto a la estación de pan del lado de la parrilla.",
                "Coloque el cubo de masa para panqueques adentro con un cucharón grande para panqueques y la tapa arriba.",
                "Revise el congelador bajo (low-boy) del lado de las freidoras para ver si es necesario reabastecer.",
                "Configure el sistema de rebozado de tres compartimentos para tiras de pollo y el cubo de masa húmeda para eglefino (haddock).",
                "Revise la calidad del aceite de las freidoras. Si está negro o saca humo, ¡debe cambiarse antes de comenzar el turno!",
                "Revise la repisa superior de pan para bollos de hamburguesa, bollos de hot dog, rollos de sándwich y tortillas, y reabastezca si es necesario.",
                "Inspeccione los niveles de aceite y verifique que los controladores de temperatura estén ajustados a 350°F.",
                "Raspue la superficie de la plancha plana para limpiarla y aplique aceite de cocina de alta temperatura para curar las zonas de calor.",
                "Revise las trampas de grasa y asegúrese de que las bandejas colectoras limpias estén en su lugar.",
                "Abastezca el congelador bajo con papas fritas, pollo y macarrones con queso al alcance de la mano.",
                "Revise las hojas de volumen esperado con el líder de cocina de la mañana.",
                "Fin de turno - Revise el congelador bajo para reabastecimiento y abastezca según corresponda.",
                "Fin de turno - Limpie la parrilla, incluido el panel de control y estantes; vacíe la trampa de grasa."
            ]
        }
    },
    range_mid_split_open: {
        title: { en: "Range/Mid-Split Open Checklist", es: "Lista de Apertura de Estufa/Media Línea (Turno Partido)" },
        items: {
            en: [
                "Turn on all primary range equipment including both ovens, waffle irons, and exhaust systems.",
                "Check the POS printer for paper and ink.",
                "Check Traulsen inventory for omelette fills, cheese, apples, and batters.",
                "Season range pans and meat grill surfaces; layout egg station utensils.",
                "Set up the mid cold table ensuring meats, batters, and veggies are fully stocked.",
                "Check/re-stock all grille-side breads.",
                "Fill the steam table half-way with water, plug in, and place 12 hot hold pans in the table.",
                "Heat steam table items to a minimum internal temperature of 131°F.",
                "Verify mandatory thaw pull upon arriving for the shift.",
                "Ensure handwash sinks are fully stocked with soap and paper towels.",
                "Divide secondary mid-station prep tasks equally between split partners.",
                "End of shift: clean range top, ovens, meat grill, and all stainless in the egg station.",
                "Re-stock Traulsen.",
                "Assist line partner with cleaning the floor.",
                "Check HACCP logs and sign off before departure."
            ],
            es: [
                "Encienda todo el equipo principal de la estufa, incluidos ambos hornos, waffleras y sistemas de extracción.",
                "Revise la impresora del POS para verificar papel y tinta.",
                "Revise el inventario del Traulsen para rellenos de tortilla, queso, manzanas y masas.",
                "Sazone las cacerolas de la estufa y las superficies de la parrilla de carne; coloque los utensilios de la estación de huevos.",
                "Prepare la mesa fría de media línea asegurando que carnes, masas y verduras estén completamente abastecidas.",
                "Revise y reabastezca todo el pan del lado de la plancha.",
                "Llene la mesa de vapor hasta la mitad con agua, conéctela y coloque 12 bandejas de mantenimiento caliente en la mesa.",
                "Caliente los artículos de la mesa de vapor a una temperatura interna mínima de 131°F.",
                "Verifique el descongelamiento obligatorio al llegar al turno.",
                "Asegúrese de que los lavamanos estén completamente abastecidos con jabón y toallas de papel.",
                "Divida las tareas secundarias de preparación de la media línea equitativamente entre los compañeros del turno partido.",
                "Fin de turno: limpie la parte superior de la estufa, hornos, parrilla de carne y todo el acero inoxidable de la estación de huevos.",
                "Reabastezca el Traulsen.",
                "Ayude al compañero de línea a limpiar el piso.",
                "Revise los registros HACCP y firme antes de retirarse."
            ]
        }
    },
    grill_fry_mid_split_open: {
        title: { en: "Grill/Fry/Mid-Split Open Checklist", es: "Lista de Apertura Parrilla/Freidora/Media Línea (Turno Partido)" },
        items: {
            en: [
                "Set up the grill with ready-to-fire sausage and bacon; prepare backup supplies and cook if needed.",
                "Place the batter bucket out with a 6th pan spacer and 1/4 ice near the bread station.",
                "Position pancake batter bucket inside with a large ladle and cover.",
                "Check fryolator low-boy freezer for required re-stocks.",
                "Set up a three-bay batter system for chicken tenders and wet batter bucket for haddock.",
                "Inspect fryolator oil quality; change immediately if black or smoking.",
                "Check the upper bread shelf for burger buns, hot dog buns, sub rolls, and tortillas.",
                "Check thaw pull requirements immediately upon arrival.",
                "Inspect and season flat-top griddle surface, verifying 350°F operating temperature.",
                "Calibrate probe thermometers and initialize HACCP opening temperature logs.",
                "Stock freezer baskets with french fries, chicken, and appetizers within reach.",
                "Coordinate shared line setup duties and sanitizer bucket rotation between split team members.",
                "End of shift - clean grill and remove/empty grease trap.",
                "End of shift - remove pancake batter bucket from the line and place in walk-in.",
                "End of shift - Assist line partner with cleaning the floor."
            ],
            es: [
                "Prepare la parrilla con salchicha y tocino listos para cocinar; prepare suministros de respaldo y cocine si es necesario.",
                "Coloque el cubo de masa con un espaciador de bandeja 1/6 y 1/4 de hielo cerca de la estación de pan.",
                "Coloque el cubo de masa para panqueques adentro con un cucharón grande y la tapa.",
                "Revise el congelador bajo de las freidoras para los reabastecimientos necesarios.",
                "Configure el sistema de rebozado de tres compartimentos para tiras de pollo y el cubo de masa húmeda para eglefino.",
                "Inspeccione la calidad del aceite de la freidora; cámbielo inmediatamente si está negro o saca humo.",
                "Revise la repisa superior de pan para bollos de hamburguesa, hot dog, rollos de sándwich y tortillas.",
                "Revise los requisitos de descongelamiento inmediatamente al llegar.",
                "Inspeccione y cure la superficie de la plancha plana, verificando la temperatura de operación de 350°F.",
                "Calibre los termómetros de sonda e inicialice los registros de temperatura de apertura HACCP.",
                "Abastezca las cestas de congelador con papas fritas, pollo y aperitivos al alcance.",
                "Coordine los deberes compartidos de configuración de línea y rotación de cubos desinfectantes entre los miembros del equipo.",
                "Fin de turno - limpie la parrilla y retire/vacíe la trampa de grasa.",
                "Fin de turno - retire el cubo de masa para panqueques de la línea y colóquelo en el refrigerador (walk-in).",
                "Fin de turno - Ayude al compañero de línea a limpiar el piso."
            ]
        }
    },
    range_mid_split_close: {
        title: { en: "Range/Mid-Split Close Checklist", es: "Lista de Cierre de Estufa/Media Línea (Turno Partido)" },
        items: {
            en: [
                "One hour prior to closing, break down vegetable and poach pans and bring to the dish pit.",
                "Brush down range tops and clean under burners.",
                "Clean traps for range and small grill, and shut down one oven.",
                "Clean all stainless steel in the egg station, including oven doors, Traulsen, and tables.",
                "Clean interior of traulsen, including wire racks.",
                "Restock traulsen, ensuring all product is rotated and covered.",
                "Clean exterior of the oven and clean interior doors of ovens.",
                "Change foil liners on top shelves as needed.",
                "Restock bread as necessary, rotating product.",
                "Drain and ice fish in the walk-in.",
                "One hour prior to closing, remove all utensils from the sandwich unit.",
                "Clean the interior top and bottom of the sandwich unit, pull out the unit, and clean the floor behind it.",
                "Flip all pans and restock items properly (one full pan per item; do not double stock).",
                "Clean the microwave inside and out, restock plates and to-go containers, and ensure sandwich items are covered.",
                "Assist other cooks to thoroughly sweep, deck brush, and mop the line floor, and check with a manager prior to leaving."
            ],
            es: [
                "Una hora antes del cierre, desmonte las cacerolas de verduras y de huevos pochados y llévelas al área de lavado.",
                "Cepille la parte superior de la estufa y limpie debajo de los quemadores.",
                "Limpie las trampas de la estufa y la parrilla pequeña, y apague un horno.",
                "Limpie todo el acero inoxidable en la estación de huevos, incluidas las puertas del horno, Traulsen y mesas.",
                "Limpie el interior del Traulsen, incluidas las rejillas de alambre.",
                "Reabastezca el Traulsen, asegurándose de que todo el producto esté rotado y cubierto.",
                "Limpie el exterior del horno y limpie las puertas interiores de los hornos.",
                "Cambie los forros de papel aluminio en las repisas superiores según sea necesario.",
                "Reabastezca el pan según sea necesario, rotando el producto.",
                "Drene y ponga hielo al pescado en el refrigerador.",
                "Una hora antes del cierre, retire todos los utensilios de la unidad de sándwiches.",
                "Limpie la parte superior e interior inferior de la unidad de sándwiches, saque la unidad y limpie el piso detrás de ella.",
                "Voltee todas las bandejas y reabastezca los artículos adecuadamente (una bandeja llena por artículo; no doble stock).",
                "Limpie el microondas por dentro y por fuera, reabastezca platos y recipientes para llevar, y asegúrese de que los artículos de sándwich estén cubiertos.",
                "Ayude a otros cocineros a barrer minuciosamente, cepillar y trapear el piso de la línea, y verifique con un gerente antes de retirarse."
            ]
        }
    },
    grill_fry_mid_split_close: {
        title: { en: "Grill/Fry/Mid-Split Close Checklist", es: "Lista de Cierre Parrilla/Freidora/Media Línea (Turno Partido)" },
        items: {
            en: [
                "One hour prior to closing, flip pancake batter to a 6th pan with a ladle and bring batter gun to the dish pit.",
                "Wipe and scrub the lower shelf of the grill and clean temperature dials.",
                "Strain fryers of excess crumbs and food particles.",
                "Wipe down stainless dividers and front of fryers, and close down one fryolator.",
                "Clean sink by steam tables, then break down and thoroughly clean steam tables.",
                "Place product from steam tables into ten (10) plastic cambros and place on cart.",
                "Wrap leftover sausage and bacon with foil, label, and place on the lower rack of the cart.",
                "Make a note on the dry erase board if fryolator oil needs changing.",
                "At close, clean grill, grill rails, and wall behind grill.",
                "Pull the grease trap for grill and dump waste oil into a metal German pan.",
                "Run grease to outside grease trap (DO NOT leave grease inside overnight!).",
                "Restock freezer with french fries, chicken, mac and cheese, etc.",
                "Perform full mid-unit closing breakdown (clean interior/exterior, rotate pans, cover items).",
                "Assist with thaw pull, sweep and mop floors, and check with manager prior to clocking out.",
                "Ensure all closing temperature logs and HACCP records are signed and secured."
            ],
            es: [
                "Una hora antes del cierre, pase la masa para panqueques a una bandeja 1/6 con un cucharón y lleve la pistola de masa al área de lavado.",
                "Limpie y talle la repisa inferior de la parrilla y limpie los diales de temperatura.",
                "Cuele las freidoras para quitar exceso de migas y partículas de comida.",
                "Limpie los divisores de acero inoxidable y el frente de las freidoras, y apague una freidora.",
                "Limpie el fregadero junto a las mesas de vapor, luego desmonte y limpie a fondo las mesas de vapor.",
                "Coloque el producto de las mesas de vapor en diez (10) cambros de plástico y colóquelos en el carrito.",
                "Envuelva la salchicha y el tocino sobrantes con papel aluminio, etiquételos y colóquelos en los estantes inferiores del carrito.",
                "Anote en el pizarrón blanco si el aceite de la freidora necesita cambio.",
                "Al cierre, limpie la parrilla, los rieles y la pared detrás de ella.",
                "Retire la trampa de grasa de la parrilla y vacíe el aceite usado en una sartén metálica alemana.",
                "Lleve la grasa a la trampa exterior (¡NO deje grasa adentro durante la noche!).",
                "Reabastezca el congelador con papas fritas, pollo, macarrones con queso, etc.",
                "Realice el desglose completo de la unidad media (limpiar interior/exterior, rotar bandejas, cubrir artículos).",
                "Ayude con el descongelamiento, barra y trapee los pisos, y consulte con el gerente antes de registrar su salida.",
                "Asegúrese de que todos los registros de temperatura de cierre y registros HACCP estén firmados y asegurados."
            ]
        }
    }
};

const MANAGER_CHECKLIST_SPECS = {
    opening_manager: {
        title: "Opening Manager Checklist",
        items: {
            en: [
                "Unlock front door, back door, turn on all lights, Sonos music, and togo platforms",
                "Review daily labor schedule and station assignments",
                "Create prep list based on current inventory and projected daily sales",
                "Properly set up BicCash in the desktop spreadsheets based on FOH assignments",
                "Assign Pre-Shift food prep to line based off prep list above",
                "Conduct a pre-shift talk-in with BOH and FOH team on daily goals",
                "Log any low-volume or 86 items in the Manager Message Board",
                "Assign extra duties as necessary to dish/utility team",
                "Check bathrooms for cleanliness, trash, and paper stock",
                "Ensure the open sign is lit by 8 a.m.",
                "Monitor the front for take-out orders and guest seating",
                "Assist service team and line as necessary throughout the shift",
                "Conduct consistent table checks to ensure guest satisfaction",
                "Monitor labor and make cuts as necessary",
                "Perform credit card audit, close down dayshift to go platforms, then enter BicCash and Daily Reconciliation on the desktop computer."
            ]
        }
    },
    closing_manager: {
        title: "Closing Manager Checklist",
        items: {
            en: [
                "Assist the day shift manager in transitioning to the evening shift",
                "Ensure FOH and BOH staff are properly assigned",
                "Assign Mid-shift prep list to line team as necessary",
                "Assign extra duties as necessary to dish/utility",
                "Conduct pre-shift talk-ins with BOH and FOH team on evening goals",
                "Monitor the front for take-out orders and guest seating",
                "Assist service team and BOH as necessary throughout the shift",
                "Conduct consistent table checks to ensure guest satisfaction",
                "Monitor labor and make cuts as necessary",
                "Assign side work and check all sidework and station cleanliness",
                "Perform credit card audit, close down night shift to go platforms, then enter BicCash and daily Reconciliation on the desktop computer",
                "Clean entry door, vacuum all rugs, and pull bar mats",
                "Ensure all trash is empty, inspect bathroom and mop entire FOH floor",
                "Conduct a line walk-through prior to line team being cut and check thaw pull for the next shift",
                "Ensure all equipment is off at close, lights off, and doors are locked."
            ]
        }
    }
};

function renderManagerAssignmentWidget(targetId) {
    if (!targetId) {
        const activeView = document.querySelector('.app-view.active');
        targetId = (activeView && activeView.id === 'view-gm-dashboard') ? 'gm-cook-widget-box' : 'mgr-cook-widget-box';
    }

    const container = document.getElementById(targetId);
    if (!container) return;

    // Fallback: if employee array is empty or filtering is too strict, show all staff members
    let cooks = Store.employees.filter(e => {
        const r = String(e.role || e.Role || "").toLowerCase();
        return !r.includes('manager') && !r.includes('gm') && !r.includes('supervisor');
    });
    if (cooks.length === 0) {
        cooks = Store.employees;
    }

    const stations = [
        { key: "range_open", label: "Range Open" },
        { key: "mid_open", label: "Mid Open" },
        { key: "grill_fry_open", label: "Grill/Fry Open" },
        { key: "range_mid_split_open", label: "Range/Mid-Split Open" },
        { key: "grill_fry_mid_split_open", label: "Grill/Fry/Mid-Split Open" }
    ];

    container.innerHTML = `
        <div class="card" style="margin-bottom: 1.5rem; background: #f8fafc; border: 1px solid #cbd5e1;">
            <h4 style="color: #1e3a8a; margin-top: 0;">👨‍🍳 Assign Cook Line Station & Shift</h4>
            <p style="font-size: 0.85rem; color: #64748b;">Assign team members to specific opening or closing kitchen stations.</p>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px; margin-top: 1rem;">
                <div>
                    <label style="font-weight: 600; font-size: 0.85rem;">Select Team Member:</label>
                    <select id="sel-cook-employee-${targetId}" class="form-control" style="margin-top: 5px;">
                        <option value="">-- Choose Team Member --</option>
                        ${cooks.map(c => `<option value="${c.id || c.ID}">${c.name || c.Name} (${c.role || c.Role || 'Staff'})</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-weight: 600; font-size: 0.85rem;">Assigned Station:</label>
                    <select id="sel-cook-station-${targetId}" class="form-control" style="margin-top: 5px;">
                        ${stations.map(st => `<option value="${st.key}">${st.label}</option>`).join('')}
                    </select>
                </div>
                <div style="align-self: flex-end;">
                    <button class="btn btn-primary" style="width: 100%;" onclick="assignCookShift('${targetId}')">Assign Cook Shift 🚀</button>
                </div>
            </div>
        </div>
    `;
}

function assignCookShift(targetId = 'mgr-cook-widget-box') {
    const empSelect = document.getElementById(`sel-cook-employee-${targetId}`);
    const stationSelect = document.getElementById(`sel-cook-station-${targetId}`);

    if (!empSelect || !empSelect.value || !stationSelect || !stationSelect.value) {
        alert("Please select both a team member and an assigned station.");
        return;
    }

    const empId = empSelect.value;
    const stationKey = stationSelect.value;
    const emp = Store.employees.find(e => String(e.id || e.ID).trim() === String(empId).trim());
    if (!emp) {
        alert("❌ Error: Selected employee record not found.");
        return;
    }

    emp.station = stationKey;
    emp.Station = stationKey;

    const todayStr = (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();

    const stationSpec = CHECKLIST_SPECS[stationKey];
    const taskItemsText = (stationSpec && stationSpec.items && stationSpec.items['en']) ? stationSpec.items['en'] : [];
    const serializedTasks = taskItemsText.map(tText => ({ label: tText, completed: false, checked: false }));

    const initialShift = {
        id: `SHIFT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        empId: emp.id || emp.ID,
        empName: emp.name || emp.Name,
        role: emp.role || emp.Role || 'cook',
        station: stationKey.replace(/_/g, ' ').toUpperCase(),
        date: todayStr,
        tasksCompleted: 0,
        totalTasks: serializedTasks.length || 15,
        scorePct: 0,
        status: "Pending Review",
        notes: JSON.stringify(serializedTasks),
        managerSignOff: false,
        tasks: serializedTasks,
        EmpId: emp.id || emp.ID,
        EmpName: emp.name || emp.Name,
        ScorePct: 0,
        TotalTasks: serializedTasks.length || 15,
        TasksCompleted: 0
    };

    Store.shifts.push(initialShift);

    Promise.all([
        ApiService.request('saveEmployee', { employee: emp }),
        ApiService.request('saveShift', { shift: initialShift })
    ]).then(() => {
        alert(`✅ Successfully assigned ${emp.name || emp.Name} to ${stationKey.replace(/_/g, ' ').toUpperCase()}!`);
        loadGlobalAppData();
    }).catch(err => {
        console.error("Error assigning cook shift:", err);
        alert("⚠️ Assignment saved locally, but cloud sync encountered an issue.");
    });
}
function renderGMManagerAssignmentWidget(targetId = 'gm-mod-widget-box') {
    const container = document.getElementById(targetId);
    if (!container) return;

    if (!Store.role || String(Store.role).toLowerCase() !== 'gm') {
        container.innerHTML = '';
        return;
    }

    const managers = Store.employees.filter(e => {
        const r = String(e.role || e.Role || "").toLowerCase();
        return r.includes('manager') || r.includes('gm') || r.includes('supervisor');
    });

    container.innerHTML = `
        <div class="card" style="margin-bottom: 1.5rem; background: #eff6ff; border: 1px solid #bfdbfe;">
            <h4 style="color: #1e3a8a; margin-top: 0;">👔 Assign Manager on Duty (MOD) Shift</h4>
            <p style="font-size: 0.85rem; color: #64748b;">Select a manager and assign an Opening or Closing Manager checklist for executive GM audit.</p>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px; margin-top: 1rem;">
                <div>
                    <label style="font-weight: 600; font-size: 0.85rem;">Select Manager:</label>
                    <select id="sel-mod-employee" class="form-control" style="margin-top: 5px;">
                        <option value="">-- Choose Manager --</option>
                        ${managers.map(m => `<option value="${m.id || m.ID}">${m.name || m.Name} (${m.role || 'Manager'})</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-weight: 600; font-size: 0.85rem;">Checklist Type & Shift:</label>
                    <select id="sel-mod-type" class="form-control" style="margin-top: 5px;">
                        <option value="opening_manager">☀️ Opening Manager Checklist</option>
                        <option value="closing_manager">🌙 Closing Manager Checklist</option>
                    </select>
                </div>
                <div style="align-self: flex-end;">
                    <button class="btn btn-primary" style="width: 100%;" onclick="assignManagerShift()">Assign MOD Checklist 🚀</button>
                </div>
            </div>
        </div>
    `;
}
function assignManagerShift() {
    const empSelect = document.getElementById('sel-mod-employee');
    const typeSelect = document.getElementById('sel-mod-type');
    
    if (!empSelect || !empSelect.value || !typeSelect || !typeSelect.value) {
        alert("Please select both a manager and a checklist type.");
        return;
    }

    const empId = empSelect.value;
    const checklistKey = typeSelect.value;
    const emp = Store.employees.find(e => String(e.id || e.ID).trim() === String(empId).trim());
    if (!emp) return;

    // Local EST Date helper
    const todayStr = (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();

    const spec = MANAGER_CHECKLIST_SPECS[checklistKey];
    const taskItemsText = spec && spec.items && spec.items['en'] ? spec.items['en'] : [];
    const serializedTasks = taskItemsText.map(tText => ({ label: tText, completed: false, checked: false }));

    const initialManagerShift = {
        id: `MOD-SHIFT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        empId: emp.id || emp.ID,
        empName: emp.name || emp.Name,
        role: 'MANAGER',
        station: spec.title,
        date: todayStr,
        tasksCompleted: 0,
        totalTasks: serializedTasks.length,
        scorePct: 0,
        status: "Pending Review",
        notes: JSON.stringify(serializedTasks),
        managerSignOff: false,
        tasks: serializedTasks,
        EmpId: emp.id || emp.ID,
        EmpName: emp.name || emp.Name,
        ScorePct: 0,
        TotalTasks: serializedTasks.length,
        TasksCompleted: 0
    };

    Store.shifts.push(initialManagerShift);
    ApiService.request('saveShift', { shift: initialManagerShift }).then(res => {
        if (res && res.success) {
            alert(`✅ Successfully assigned ${emp.name || emp.Name} to ${spec.title}! Audit record posted.`);
            if (typeof renderGMDashboard === 'function') renderGMDashboard();
        } else {
            alert("⚠️ Failed to sync manager shift record to cloud.");
        }
    });
}

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

function handleLogin(e) {
    e.preventDefault();
    const passwordInput = document.getElementById('auth-password');
    if (!passwordInput) return;
    const pin = passwordInput.value.trim();

    if (pin === CONFIG.GM_MASTER_PASSCODE) {
        Store.setSession({ id: "GM-ADMIN", name: "General Manager", role: "gm", station: "All" }, "gm");
        loadGlobalAppData();
        finalizeLogin();
        return;
    }

    const emp = Store.employees.find(e => String(e.pin || e.PIN).trim() === pin && (e.active === true || String(e.active).toLowerCase() === 'true'));
    if (emp) {
        Store.setSession(emp, emp.role || emp.Role || 'cook');
        loadGlobalAppData();
        finalizeLogin();
        return;
    }

    ApiService.request('authenticate', { password: pin }).then(res => {
        if (res && res.success) {
            Store.setSession(res.employee || { id: "EMP-001", name: "Employee", role: res.role || "cook", station: "range_open" }, res.role || 'cook');
            loadGlobalAppData();
            finalizeLogin();
        } else {
            alert(res && res.error ? res.error : "Invalid PIN or Passcode.");
        }
    });
}

function finalizeLogin() {
    document.getElementById('auth-modal').style.display = 'none';
    document.getElementById('app-wrapper').style.display = 'block';
    
    if (Store.user && Store.user.station && Store.user.station !== 'All' && Store.user.station !== 'Management') {
        Store.assignedChecklistKey = Store.user.station;
        Store.assignedStation = Store.user.station.replace(/_/g, ' ').toUpperCase();
    }

    updateGreetingLabel();
    buildNavForRole(Store.role);
    renderChecklists();
}

function renderCookChecklistGated() {
    // 1. Locate the container across potential DOM IDs
    const container = document.getElementById('checklist-container') || 
                      document.getElementById('cook-dashboard-content') || 
                      document.getElementById('cook-checklist-view');
    
    if (!container) {
        console.warn("Cook checklist container element not found in DOM.");
        return;
    }

    if (!Store.user) return;

    // 2. Resolve the assigned station key (e.g. 'range_open', 'grill_fry_open', etc.)
    // Check Store.user.station first, then fallback store properties
    const rawStation = Store.assignedStationKey || Store.assignedChecklistKey || Store.assignedStation || (Store.user ? Store.user.station : '');
    const stationKey = String(rawStation).trim().toLowerCase();

    // 3. Directly pull tasks from CHECKLIST_SPECS using the station key and current language
    let tasks = [];
    if (stationKey && CHECKLIST_SPECS[stationKey]) {
        const langLang = Store.lang || 'en';
        const specItems = CHECKLIST_SPECS[stationKey].items;
        if (specItems) {
            tasks = specItems[langLang] || specItems['en'] || [];
        }
    }

    // Secondary fallbacks if not matched in specs
    if (!Array.isArray(tasks) || tasks.length === 0) {
        tasks = Store.assignedStationTasks || Store.currentChecklistTasks || Store.activeChecklist || [];
    }

    let tasksHtml = "";
    if (Array.isArray(tasks) && tasks.length > 0) {
        tasksHtml = tasks.map((t, idx) => {
            const label = typeof t === 'string' ? t : (t.label || t.name || t.text || `Task ${idx + 1}`);
            return `
                <div style="display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid #f1f5f9;">
                    <span style="font-size: 1.1rem; color: #64748b;">📄</span>
                    <div style="flex: 1;">
                        <span style="font-size: 0.95rem; color: #1e293b; font-weight: 500;">${label}</span>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        tasksHtml = `
            <div style="padding: 20px; text-align: center; color: #64748b; background: #f8fafc; border-radius: 6px;">
                <p style="margin: 0;">No active station tasks currently assigned for <strong>${stationKey || 'your station'}</strong>. Please check with your manager for station assignment.</p>
            </div>
        `;
    }

    const prettyStationName = stationKey ? stationKey.replace(/_/g, ' ').toUpperCase() : 'NONE';

    container.innerHTML = `
        <div class="card" style="margin-bottom: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 10px;">
                <h3 style="color: #1e3a8a; margin: 0;">Station Checklist & Prep Task List (Read-Only)</h3>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-secondary" onclick="toggleLanguage()">🌐 Translate</button>
                    <button class="btn btn-secondary" onclick="window.print()">🖨️ Print Checklist</button>
                </div>
            </div>
            <p style="font-size: 0.85rem; color: #64748b; margin: 0;">Assigned Station: <strong>${prettyStationName}</strong>. Review your tasks below. All audits, score check-offs, and final sign-offs are conducted by management during the Shift Audit.</p>
        </div>
        <div class="card">
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0 15px; max-height: 450px; overflow-y: auto;">
                ${tasksHtml}
            </div>
        </div>
    `;
}
function completeSpecialProject() {
    if (!Store.user) return;
    
    // Mark as completed with exact status string required by manager dashboard filters
    Store.user.specialProjectStatus = "Completed - Pending Sign-Off";
    
    // Save the employee update to the Google Sheet backend
    ApiService.request('saveEmployee', { employee: Store.user }).then(res => {
        if (res && res.success) {
            alert("✅ Special project marked complete and submitted to management for sign-off!");
            
            // Force an immediate global cloud reload so managers see it instantly across devices
            loadGlobalAppData();
        } else {
            alert("⚠️ Project marked complete locally, but cloud sync encountered an issue.");
            UIController.refreshActiveView();
        }
    }).catch(err => {
        console.error("Error saving completed special project:", err);
        alert("❌ Error connecting to cloud backend. Please check your network connection.");
    });
}

function renderManagerChecklist() {
    const container = document.getElementById('manager-checklist-content');
    if (!container) return;

    const todayStr = (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();

    const activeUserId = String(Store.currentUser && (Store.currentUser.id || Store.currentUser.ID) || "").trim();
    
    const assignedShift = Store.shifts.find(s => {
        const role = String(s.role || s.Role || "").toUpperCase();
        if (role !== 'MANAGER') return false;
        
        const shiftEmpId = String(s.empId || s.EmpId || s.EMPID || "").trim();
        const rawDate = String(s.date || s.Date || s.DATE || "").trim().substring(0, 10);
        
        return shiftEmpId === activeUserId && rawDate === todayStr;
    });

    if (!assignedShift) {
        container.innerHTML = `
            <div class="card" style="text-align: center; padding: 2rem;">
                <h3 style="color: #1e3a8a; margin-top: 0;">📋 Manager on Duty (MOD) Checklist</h3>
                <p style="color: #64748b; font-size: 0.9rem;">No manager shift has been assigned to you for today yet by the General Manager.</p>
            </div>
        `;
        return;
    }

    // Retrieve tasks correctly from assigned shift or specifications
    let tasks = assignedShift.tasks || assignedShift.Tasks || [];
    if (!tasks || tasks.length === 0) {
        if (assignedShift.notes && typeof assignedShift.notes === 'string' && assignedShift.notes.startsWith('[')) {
            try { tasks = JSON.parse(assignedShift.notes); } catch(e) { tasks = []; }
        }
    }
    
    // Fallback lookup from MANAGER_CHECKLIST_SPECS if tasks array is empty
    if ((!tasks || tasks.length === 0) && assignedShift.station) {
        const matchingKey = Object.keys(MANAGER_CHECKLIST_SPECS).find(k => MANAGER_CHECKLIST_SPECS[k].title === assignedShift.station);
        if (matchingKey && MANAGER_CHECKLIST_SPECS[matchingKey].items && MANAGER_CHECKLIST_SPECS[matchingKey].items['en']) {
            tasks = MANAGER_CHECKLIST_SPECS[matchingKey].items['en'].map(tText => ({ label: tText, completed: false, checked: false }));
        }
    }

    const tasksListHTML = tasks.map((t, idx) => {
        const isChecked = t.completed || t.checked || t.Completed || t.Checked;
        const taskText = typeof t === 'string' ? t : (t.label || t.text || t.Name || '');
        return `
            <div style="display: flex; align-items: flex-start; gap: 10px; padding: 10px 0; border-bottom: 1px solid #f1f5f9;">
                <input type="checkbox" 
                       style="width: 18px; height: 18px; margin-top: 2px; cursor: not-allowed;" 
                       ${isChecked ? 'checked' : ''} 
                       disabled>
                <div style="flex: 1;">
                    <span style="font-size: 0.9rem; color: #1e293b; font-weight: 500;">${taskText}</span>
                </div>
            </div>
        `;
    }).join('');

    const shiftTitle = assignedShift.station || assignedShift.Station || 'Manager Operational Checklist';

    container.innerHTML = `
        <div class="card" style="margin-bottom: 1.5rem; border-left: 4px solid #1e3a8a;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 1rem;">
                <div>
                    <h3 style="color: #1e3a8a; margin: 0;">📋 Assigned MOD Shift: ${shiftTitle}</h3>
                    <p style="font-size: 0.85rem; color: #64748b; margin: 4px 0 0 0;">Date: ${assignedShift.date || assignedShift.Date} | Status: <strong>${assignedShift.status || 'Pending Review'}</strong></p>
                </div>
                <div>
                    <span style="background: #e0f2fe; color: #0369a1; padding: 6px 12px; border-radius: 6px; font-weight: bold; font-size: 0.85rem;">🔒 Read-Only MOD View</span>
                </div>
            </div>
            
            <div style="max-height: 450px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0 15px; background: #ffffff;">
                ${tasksListHTML}
            </div>
        </div>
    `;
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

function renderChecklists() {
    if (Store.role === 'manager' || Store.role === 'gm') { renderManagerChecklist(); return; }
    renderCookChecklistGated();
}


function submitCookShiftChecklist() {
    const cbs = document.querySelectorAll('.task-checkbox');
    const total = cbs.length;
    let checked = 0;
    
    // Build the tasks array from the DOM checkboxes
    const tasksArray = [];
    cbs.forEach(cb => {
        const isChecked = cb.checked;
        if (isChecked) checked++;
        
        let labelText = "Task item";
        const parentLabel = cb.closest('label');
        const parentRow = cb.closest('.task-row') || cb.parentElement;
        
        if (parentLabel) {
            labelText = parentLabel.innerText.trim();
        } else if (parentRow) {
            labelText = parentRow.innerText.trim();
        }

        tasksArray.push({
            label: labelText,
            completed: isChecked,
            checked: isChecked
        });
    });

    const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
    
    // Helper for local date string
    const todayStr = (() => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    })();

    const shiftRecord = {
        id: `SHIFT-${Date.now()}`,
        empId: Store.user.id || Store.user.ID,
        empName: Store.user.name || Store.user.Name,
        role: Store.role,
        station: Store.assignedStation || Store.assignedChecklistKey || 'Cook Station',
        date: todayStr,
        tasksCompleted: checked,
        totalTasks: total,
        scorePct: pct,
        status: pct >= 85 ? "Completed" : "Needs Review",
        // Store tasks serialized as a JSON string in notes so Google Sheets preserves them!
        notes: JSON.stringify(tasksArray),
        managerSignOff: false,
        tasks: tasksArray // kept in memory for immediate use
    };

    // Send to Google Sheets backend via API Service
    ApiService.request('saveShift', { shift: shiftRecord }).then(res => {
        alert(`🎉 Checklist submitted successfully! Score: ${pct}%. Sent to Manager Dashboard for review.`);
        Store.assignedStation = null;
        Store.assignedChecklistKey = null;

        Store.selectedShiftDate = todayStr;
        loadGlobalAppData();

        if (Store.role === 'cook') {
            switchTab('cook-dashboard', document.querySelector('.tab-btn'));
        } else {
            UIController.refreshActiveView();
        }
    }).catch(err => {
        console.error("Error submitting shift checklist:", err);
        alert("❌ Failed to save checklist to the cloud. Please check your connection.");
    });
}
function renderManagerAssignmentWidget() {
    const container = document.getElementById('manager-assignment-widget-container');
    if (!container) return;

    const managers = Store.employees.filter(e => {
        const r = String(e.role || e.Role || "").toLowerCase();
        return r.includes('manager') || r.includes('gm') || r.includes('supervisor');
    });

    const todayStr = (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();

    container.innerHTML = `
        <div class="card" style="margin-bottom: 1.5rem; background: #f8fafc; border: 1px solid #cbd5e1;">
            <h4 style="color: #1e3a8a; margin-top: 0;">👔 Assign Manager on Duty (MOD) Shift</h4>
            <p style="font-size: 0.85rem; color: #64748b;">Assign an Opening or Closing Manager checklist to a MOD. Once assigned, it will appear read-only on their dashboard.</p>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px; margin-top: 1rem;">
                <div>
                    <label style="font-weight: 600; font-size: 0.85rem;">Select Manager:</label>
                    <select id="sel-mod-employee" class="form-control" style="margin-top: 5px;">
                        <option value="">-- Choose Manager --</option>
                        ${managers.map(m => `<option value="${m.id || m.ID}">${m.name || m.Name} (${m.role || 'Manager'})</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-weight: 600; font-size: 0.85rem;">Checklist Type & Shift:</label>
                    <select id="sel-mod-type" class="form-control" style="margin-top: 5px;">
                        <option value="opening_manager">☀️ Opening Manager Checklist</option>
                        <option value="closing_manager">🌙 Closing Manager Checklist</option>
                    </select>
                </div>
                <div style="align-self: flex-end;">
                    <button class="btn btn-primary" style="width: 100%;" onclick="assignManagerShift()">Assign MOD Checklist 🚀</button>
                </div>
            </div>
        </div>
    `;
}

function renderGMManagerAssignmentWidget() {
    // Only render for General Manager
    if (!Store.role || String(Store.role).toLowerCase() !== 'gm') return;

    const container = document.getElementById('gm-manager-assignment-widget-container') || document.getElementById('manager-assignment-widget-container');
    if (!container) return;

    const managers = Store.employees.filter(e => {
        const r = String(e.role || e.Role || "").toLowerCase();
        return r.includes('manager') || r.includes('gm') || r.includes('supervisor');
    });

    container.innerHTML = `
        <div class="card" style="margin-bottom: 1.5rem; background: #eff6ff; border: 1px solid #bfdbfe;">
            <h4 style="color: #1e3a8a; margin-top: 0;">👔 Assign Manager on Duty (MOD) Shift</h4>
            <p style="font-size: 0.85rem; color: #64748b;">Select a manager and assign an Opening or Closing Manager checklist for executive GM audit.</p>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px; margin-top: 1rem;">
                <div>
                    <label style="font-weight: 600; font-size: 0.85rem;">Select Manager:</label>
                    <select id="sel-mod-employee" class="form-control" style="margin-top: 5px;">
                        <option value="">-- Choose Manager --</option>
                        ${managers.map(m => `<option value="${m.id || m.ID}">${m.name || m.Name} (${m.role || 'Manager'})</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-weight: 600; font-size: 0.85rem;">Checklist Type & Shift:</label>
                    <select id="sel-mod-type" class="form-control" style="margin-top: 5px;">
                        <option value="opening_manager">☀️ Opening Manager Checklist</option>
                        <option value="closing_manager">🌙 Closing Manager Checklist</option>
                    </select>
                </div>
                <div style="align-self: flex-end;">
                    <button class="btn btn-primary" style="width: 100%;" onclick="assignManagerShift()">Assign MOD Checklist 🚀</button>
                </div>
            </div>
        </div>
    `;
}

function assignManagerShift() {
    const empSelect = document.getElementById('sel-mod-employee');
    const typeSelect = document.getElementById('sel-mod-type');
    
    if (!empSelect || !empSelect.value || !typeSelect || !typeSelect.value) {
        alert("Please select both a manager and a checklist type.");
        return;
    }

    const empId = empSelect.value;
    const checklistKey = typeSelect.value;
    const emp = Store.employees.find(e => String(e.id || e.ID).trim() === String(empId).trim());
    if (!emp) return;

    const todayStr = (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();

    const spec = MANAGER_CHECKLIST_SPECS[checklistKey];
    const taskItemsText = spec && spec.items && spec.items['en'] ? spec.items['en'] : [];
    const serializedTasks = taskItemsText.map(tText => ({ label: tText, completed: false, checked: false }));

    const initialManagerShift = {
        id: `MOD-SHIFT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        empId: emp.id || emp.ID,
        empName: emp.name || emp.Name,
        role: 'MANAGER',
        station: spec.title,
        date: todayStr,
        tasksCompleted: 0,
        totalTasks: serializedTasks.length,
        scorePct: 0,
        status: "Pending Review",
        notes: JSON.stringify(serializedTasks),
        managerSignOff: false,
        tasks: serializedTasks,
        EmpId: emp.id || emp.ID,
        EmpName: emp.name || emp.Name,
        ScorePct: 0,
        TotalTasks: serializedTasks.length,
        TasksCompleted: 0
    };

    Store.shifts.push(initialManagerShift);
    ApiService.request('saveShift', { shift: initialManagerShift }).then(res => {
        if (res && res.success) {
            alert(`✅ Successfully assigned ${emp.name || emp.Name} to ${spec.title}! It is now visible on their dashboard.`);
            if (typeof renderGMDashboard === 'function') renderGMDashboard();
        } else {
            alert("⚠️ Failed to sync manager shift record to cloud.");
        }
    });
}
function renderSpecialProjectWidget() {
    const container = document.getElementById('special-project-widget-container');
    if (!container) return;

    const today = new Date();
    const dayOfWeek = today.getDay();
    const isWeekendDay = (dayOfWeek === 0 || dayOfWeek === 6);

    if (isWeekendDay) {
        container.innerHTML = `
            <div class="card" style="background: #fef2f2; border: 1px solid #fecaca; margin-bottom: 1.5rem;">
                <h4 style="color: #991b1b; margin-top: 0;">🛠️ Special Projects & Extra Duties</h4>
                <p style="color: #b91c1c; font-size: 0.85rem; margin-bottom: 0;">
                    🚫 <strong>Restricted:</strong> Special project assignments are disabled on Saturday and Sunday day shifts per operational guidelines.
                </p>
            </div>
        `;
        return;
    }

    const uniqueEmployees = Array.from(new Map(Store.employees.map(emp => [String(emp.id || emp.ID || emp.name || emp.Name).trim(), emp])).values());
    const optionsHtml = uniqueEmployees.map(e => `<option value="${e.id || e.ID}">${e.name || e.Name}</option>`).join('');

    container.innerHTML = `
        <div class="card" style="margin-bottom: 1.5rem; background: #f8fafc; border: 1px solid #cbd5e1;">
            <h4 style="color: #1e3a8a; margin-top: 0;">🛠️ Assign Special Project / Extra Duty</h4>
            <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 1rem;">Delegate specialized tasks (e.g., fryolator oil change, deep clean ovens, walk-in detailing) to cooks during slower shifts.</p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; margin-bottom: 1rem;">
                <div>
                    <label style="font-size: 0.85rem; font-weight: bold;">Select Cook:</label>
                    <select id="special-proj-emp" class="form-control" style="width: 100%; margin-top: 4px;">
                        <option value="">-- Select Cook --</option>
                        ${optionsHtml}
                    </select>
                </div>
                <div>
                    <label style="font-size: 0.85rem; font-weight: bold;">Project / Task Description:</label>
                    <input type="text" id="special-proj-desc" class="form-control" placeholder="e.g., Deep clean ovens & detail walk-in" style="width: 100%; margin-top: 4px;">
                </div>
            </div>
            <button class="btn btn-primary" onclick="assignSpecialProject()">Assign to Cook's Dashboard 📌</button>
        </div>
    `;
}

function assignSpecialProject() {
    const today = new Date();
    if (today.getDay() === 0 || today.getDay() === 6) {
        alert("❌ Error: Special project assignments are not permitted on Saturday or Sunday day shifts.");
        return;
    }

    const empIdSelect = document.getElementById('special-proj-emp');
    const taskDescInput = document.getElementById('special-proj-desc');
    
    if (!empIdSelect || !taskDescInput) return;

    const empId = empIdSelect.value;
    const taskDesc = taskDescInput.value.trim();

    if (!empId || !taskDesc) {
        alert("Please select a cook and enter a task description.");
        return;
    }

    // Find the specific employee in our local store
    const emp = Store.employees.find(e => String(e.id || e.ID).trim() === String(empId).trim());
    if (!emp) {
        alert("❌ Error: Selected employee could not be found.");
        return;
    }

    // Assign project details directly to their record object
    emp.specialProject = taskDesc;
    emp.specialProjectStatus = "Assigned / In Progress";

    // Save this specific employee record to the Google Sheet backend
    ApiService.request('saveEmployee', { employee: emp }).then(res => {
        if (res && res.success) {
            alert(`✅ Special project assigned successfully to ${emp.name || emp.Name}! It will appear on their dashboard.`);
            taskDescInput.value = '';
            empIdSelect.value = '';
            
            // Immediately reload global data so state is synced across all devices
            loadGlobalAppData();
        } else {
            alert("⚠️ Project saved locally, but cloud sync encountered an issue.");
        }
    }).catch(err => {
        console.error("Error assigning special project:", err);
        alert("❌ Network error connecting to backend.");
    });
}
function assignCooksGroup(selectIds) {
    let assignedCount = 0;
    
    // Explicit local EST date helper to prevent premature UTC date rollover
    const todayStr = (() => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    })();

    selectIds.forEach(id => {
        const selectEl = document.getElementById(id);
        if (!selectEl || !selectEl.value) return;
        const stationKey = id.replace('sel-', '');
        const empId = selectEl.value;
        const emp = Store.employees.find(e => String(e.id || e.ID).trim() === String(empId).trim());
        
        if (emp) {
            emp.station = stationKey;
            emp.Station = stationKey;
            
            // 1. Save employee station update
            ApiService.request('saveEmployee', { employee: emp });

            // 2. Automatically generate the pending shift record for manager audit in Google Sheets
            // Pull the exact task list items from CHECKLIST_SPECS for this station so the manager has them to audit
            const stationSpec = CHECKLIST_SPECS[stationKey];
            const taskItemsText = (stationSpec && stationSpec.items && stationSpec.items['en']) ? stationSpec.items['en'] : [];
            const serializedTasks = taskItemsText.map(tText => ({ label: tText, completed: false, checked: false }));

            const initialShift = {
                id: `SHIFT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                empId: emp.id || emp.ID,
                empName: emp.name || emp.Name,
                role: emp.role || 'cook',
                station: stationKey.replace(/_/g, ' ').toUpperCase(),
                date: todayStr,
                tasksCompleted: 0,
                totalTasks: serializedTasks.length || 15,
                scorePct: 0,
                status: "Pending Review",
                notes: JSON.stringify(serializedTasks),
                managerSignOff: false,
                tasks: serializedTasks,
                // GAS Aliases
                EmpId: emp.id || emp.ID,
                EmpName: emp.name || emp.Name,
                ScorePct: 0,
                TotalTasks: serializedTasks.length || 15,
                TasksCompleted: 0
            };
            
            Store.shifts.push(initialShift);
            ApiService.request('saveShift', { shift: initialShift });
            
            if (Store.user && String(Store.user.id).trim() === String(emp.id).trim()) {
                Store.assignedChecklistKey = stationKey;
                Store.assignedStation = stationKey.replace(/_/g, ' ').toUpperCase();
            }
            assignedCount++;
        }
    });
    
    if (assignedCount > 0) {
        alert(`✅ Successfully assigned ${assignedCount} cook(s)! Shift audit records have been posted to Google Sheets.`);
        if (typeof renderManagerAssignmentWidget === 'function') {
            renderManagerAssignmentWidget();
        }
        loadGlobalAppData();
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
        totalTasks: total, scorePct: pct, notes: pct >= 85 ? "Goal Met" : "Needs Improvement",
        managerSignOff: false
    };
    Store.shifts.push(shiftRecord);
    ApiService.request('saveShift', { shift: shiftRecord }).then(res => {
        alert(`🎉 Shift submitted! Score: ${pct}%`);
        switchTab('manager-dashboard', document.querySelector('.tab-btn'));
    });
}

function managerSignOffShift(shiftId) {
    const shift = Store.shifts.find(s => String(s.id || s.ID).trim() === String(shiftId).trim());
    if (!shift) {
        alert("❌ Shift record not found.");
        return;
    }

    // 1. Capture live checkbox states directly from the DOM elements currently rendered in the modal if open,
    // otherwise fallback to shift.tasks / shift.notes.
    let tasks = shift.tasks || shift.Tasks || [];
    if (typeof tasks === 'string') {
        try { tasks = JSON.parse(tasks); } catch (e) { tasks = []; }
    }
    if (!Array.isArray(tasks) || tasks.length === 0) {
        if (typeof shift.notes === 'string' && shift.notes.startsWith('[')) {
            try { tasks = JSON.parse(shift.notes); } catch (e) { tasks = []; }
        }
    }

    // If modal is open, let's sync state from the actual HTML checkboxes on screen to be 100% sure we catch what the manager checked!
    const modalCheckboxes = document.querySelectorAll('#shift-modal-body input[type="checkbox"]');
    if (modalCheckboxes && modalCheckboxes.length > 0 && tasks.length === modalCheckboxes.length) {
        modalCheckboxes.forEach((cb, idx) => {
            if (tasks[idx]) {
                tasks[idx].completed = cb.checked;
                tasks[idx].checked = cb.checked;
            }
        });
    }

    const totalTasks = tasks.length > 0 ? tasks.length : 15;
    const completedCount = tasks.filter(t => t && (t.completed === true || t.checked === true)).length;
    
    const totalPointsPossible = totalTasks * 10;
    const pointsEarned = completedCount * 10;
    const percentageScore = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
    
    // Tier Evaluation Logic based on your exact task counts:
    // Gold = 13-15, Silver = 10-12, Bronze = 8-9, Needs Improvement = < 8
    let tierLabel = "Needs Improvement ⚠️";
    if (completedCount >= 13) tierLabel = "Gold 🥇";
    else if (completedCount >= 10) tierLabel = "Silver 🥈";
    else if (completedCount >= 8) tierLabel = "Bronze 🥉";
    
    // Explicitly update all property variations so backend Google Sheets and UI catch them
    shift.scorePct = percentageScore;
    shift.ScorePct = percentageScore;
    shift.SCOREPCT = percentageScore;
    shift.tasksCompleted = completedCount;
    shift.TasksCompleted = completedCount;
    shift.totalTasks = totalTasks;
    shift.TotalTasks = totalTasks;
    shift.pointsEarned = pointsEarned;
    shift.totalPointsPossible = totalPointsPossible;
    shift.status = tierLabel;
    shift.Status = tierLabel;
    shift.notes = JSON.stringify(tasks);
    shift.tasks = tasks;
    
    shift.managerSignOff = true;
    shift.ManagerSignOff = true;
    shift.signedOffBy = Store.user ? (Store.user.name || Store.user.Name) : "Manager";

    ApiService.request('saveShift', { shift }).then(res => {
        if (res && res.success) {
            alert(`✅ Shift successfully audited & signed off!\nCompleted: ${completedCount}/${totalTasks} tasks (${pointsEarned} pts)\nScore: ${percentageScore}% | Tier: ${tierLabel}`);
            loadGlobalAppData();
        } else {
            alert("⚠️ Failed to sync shift sign-off with cloud.");
        }
    }).catch(err => {
        console.error("Error signing off shift:", err);
        alert("❌ Network error connecting to backend.");
    });
}
function managerSignOffSpecialProject(empId) {
    if (Store.role !== 'manager' && Store.role !== 'gm') {
        alert("❌ Unauthorized: Manager or GM role required.");
        return;
    }
    
    // Find employee using robust string-trimmed property lookup
    const targetEmpId = String(empId || "").trim();
    const emp = Store.employees.find(e => {
        const currentId = String(e.id || e.ID || "").trim();
        return currentId === targetEmpId;
    });

    if (!emp) {
        alert("❌ Employee record not found.");
        return;
    }
    
    // Update the employee record's special project status and sign-off metadata
    emp.specialProjectStatus = "Signed Off & Completed";
    emp.signedOffBy = Store.user ? (Store.user.name || Store.user.Name) : "Manager";
    
    // Send updated employee record to the Google Sheets backend
    ApiService.request('saveEmployee', { employee: emp }).then(res => {
        if (res && res.success) {
            const empName = emp.name || emp.Name || "Employee";
            alert(`✅ Special project for ${empName} has been signed off successfully!`);
            
            // Force an immediate global cloud reload so dashboards update instantly
            loadGlobalAppData();
        } else {
            alert("⚠️ Failed to sync special project sign-off with the cloud backend.");
        }
    }).catch(err => {
        console.error("Error signing off special project:", err);
        alert("❌ Network error connecting to backend while signing off project.");
    });
}
function renderMessageBoard() {
    const container = document.getElementById('message-board-container');
    if (!container) return;

    // Default selected date to today if not already set
    if (!Store.selectedMessageDate) {
        Store.selectedMessageDate = new Date().toISOString().split('T')[0];
    }

    const categories = ["Maintenance", "Injuries", "Customers", "Employees", "86 Items", "General"];
    
    let html = `
        <div class="card" style="margin-bottom: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 1rem;">
                <div>
                    <h3 style="color: #1e3a8a; margin: 0 0 4px 0;">💬 Management Message Board</h3>
                    <p style="font-size: 0.85rem; color: #64748b; margin: 0;">Post operational updates across channels.</p>
                </div>
                <div>
                    <label style="font-weight: 600; font-size: 0.85rem; margin-right: 6px;">Filter Date:</label>
                    <input type="date" id="msg-calendar-filter" class="form-control" value="${Store.selectedMessageDate}" onchange="handleMessageDateLookup(this.value)" style="display: inline-block; width: auto; margin-bottom: 0;">
                </div>
            </div>

            <form onsubmit="postMessage(event)" style="display: flex; flex-direction: column; gap: 10px; margin-top: 1rem;">
                <select id="msg-category" class="form-control" required>
                    <option value="">-- Select Channel --</option>
                    ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
                </select>
                <textarea id="msg-text" class="form-control" rows="3" placeholder="Type operational update..." required></textarea>
                <button type="submit" class="btn btn-primary" style="align-self: flex-start;">Post Message 📢</button>
            </form>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem;">
    `;

    categories.forEach(cat => {
        // Filter messages matching the category AND the selected filter date
        const catMessages = Store.messages.filter(m => {
            const matchesCat = String(m.category || "").trim().toLowerCase() === cat.toLowerCase();
            
            // Match against explicit message date or timestamp string
            const msgDateStr = String(m.date || m.timestamp || "").trim().split('T')[0];
            const matchesDate = msgDateStr.includes(Store.selectedMessageDate);
            
            return matchesCat && matchesDate;
        });

        html += `
            <div class="card" style="background: #f8fafc; border: 1px solid #e2e8f0;">
                <h4 style="color: #1e3a8a; margin-top: 0; border-bottom: 2px solid #cbd5e1; padding-bottom: 6px;">📌 ${cat}</h4>
                <div style="max-height:250px; overflow-y:auto; display:flex; flex-direction:column; gap:8px;">
                    ${catMessages.length === 0 ? 
                        `<p style="font-size: 0.80rem; color: #94a3b8; font-style: italic;">No posts for ${Store.selectedMessageDate}.</p>` : 
                        catMessages.map(m => `
                            <div style="background: white; padding: 8px; border-radius: 4px; border: 1px solid #cbd5e1; font-size: 0.85rem;">
                                <div style="display: flex; justify-content: space-between; font-weight: bold; color: #334155; margin-bottom: 4px;">
                                    <span>${m.authorName || 'Staff'}</span>
                                    <span style="font-size:0.75rem;color:#94a3b8;">${m.timestamp || ''}</span>
                                </div>
                                <p style="margin: 0; color: #475569;">${m.messageText || m.text || ''}</p>
                            </div>
                        `).join('')}
                </div>
            </div>
        `;
    });

    html += `</div>`;
    container.innerHTML = html;
}

function handleMessageDateLookup(dateVal) {
    if (!dateVal) return;
    Store.selectedMessageDate = String(dateVal).trim().split('T')[0];
    renderMessageBoard();
}

function postMessage(e) {
    e.preventDefault();
    if (!Store.user) return;
    
    const category = document.getElementById('msg-category').value;
    const messageText = document.getElementById('msg-text').value.trim();
    const todayStr = new Date().toISOString().split('T')[0];

    const payload = { 
        id: `MSG-${Date.now()}`, 
        category, 
        authorName: Store.user.name, 
        timestamp: new Date().toLocaleString(), 
        date: todayStr, // Added explicit date string for calendar filtering
        messageText 
    };

    Store.messages.push(payload);
    ApiService.request('saveMessage', { message: payload }).then(() => { 
        document.getElementById('msg-text').value = ''; 
        Store.selectedMessageDate = todayStr; // Automatically shift view to today's date upon posting
        renderMessageBoard(); 
    });
}

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
    if (!container || !Store.user) return;

    const cookId = String(Store.user.id || Store.user.ID || "").trim();
    const cookName = String(Store.user.name || Store.user.Name || "").trim().toLowerCase();

    const myShifts = Store.shifts.filter(s => {
        const sEmpId = String(s.empId || s.EmpId || "").trim();
        const sEmpName = String(s.empName || s.EmpName || "").trim().toLowerCase();
        
        const matchesId = cookId !== "" && sEmpId === cookId;
        const matchesName = cookName !== "" && sEmpName === cookName;
        
        // ONLY show shifts in the performance log that have been signed off by management
        const isSignedOff = s.managerSignOff === true || String(s.managerSignOff).toLowerCase() === 'true' || s.ManagerSignOff === true;

        return (matchesId || matchesName) && isSignedOff;
    });

    let rowsHtml = myShifts.length === 0 ? `<tr><td colspan="6" style="text-align: center; color: #64748b;">${t('noShifts') || 'No completed & signed-off shift records found.'}</td></tr>` :
        myShifts.map(s => {
            // Parse tasks for dynamic calculation
            let tasks = s.tasks || s.Tasks || [];
            if (typeof s.notes === 'string' && s.notes.startsWith('[')) {
                try { tasks = JSON.parse(s.notes); } catch(e) {}
            }
            const totalTasks = Number(s.totalTasks || s.TotalTasks || tasks.length || 15);
            const tasksCompleted = Number(s.tasksCompleted || s.TasksCompleted || tasks.filter(t => t.completed || t.checked).length);

            let score = Number(s.scorePct || s.ScorePct || 0);
            if (score === 0 && totalTasks > 0 && tasksCompleted > 0) {
                score = Math.round((tasksCompleted / totalTasks) * 100);
            }

            let tierLabel = s.status || s.Status || '';
            if (!tierLabel || tierLabel === 'Completed' || tierLabel === 'Needs Review' || tierLabel === 'Pending Review' || score > 0) {
                if (tasksCompleted >= 13) tierLabel = "Gold 🥇";
                else if (tasksCompleted >= 10) tierLabel = "Silver 🥈";
                else if (tasksCompleted >= 8) tierLabel = "Bronze 🥉";
                else tierLabel = "Needs Improvement ⚠️";
            }

            const pointsEarned = tasksCompleted * 10;
            const totalPointsPossible = totalTasks * 10;

            return `<tr>
                <td>${s.date || s.Date || ''}</td>
                <td>${s.station || s.Station || 'General'}</td>
                <td>${tasksCompleted} / ${totalTasks} (${pointsEarned}/${totalPointsPossible} pts)</td>
                <td><strong>${score}%</strong></td>
                <td><span style="font-weight: bold; color: #1e3a8a;">${tierLabel}</span></td>
                <td><span style="color: #166534; font-weight: bold;">✅ Approved & Logged</span></td>
            </tr>`;
        }).join('');

    container.innerHTML = `
        <div class="card" style="margin-bottom: 1.5rem;">
            <h3 style="color: #1e3a8a; margin-top: 0;">${t('cookDashTitle') || 'Cook Dashboard & Performance Log'}</h3>
            <p style="font-size: 0.85rem; color: #64748b;">${t('cookDashSub') || 'View your officially audited and manager-approved shift records below.'}</p>
        </div>
        <div class="card">
            <table class="data-table" style="width: 100%;">
                <thead>
                    <tr>
                        <th>${t('tblDate') || 'Date'}</th>
                        <th>${t('tblStation') || 'Station'}</th>
                        <th>${t('tblCompletedTasks') || 'Completed Tasks (Pts)'}</th>
                        <th>${t('tblScore') || 'Score'}</th>
                        <th>Tier Level</th>
                        <th>Sign-Off</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        </div>`;
}
function renderManagerDashboard() {
    const container = document.getElementById('manager-dashboard-content');
    if (!container) return;
    
    if (!Store.selectedShiftDate) {
        Store.selectedShiftDate = (() => {
            const d = new Date();
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        })();
    }
    
    const lookupDate = String(Store.selectedShiftDate || "").trim().split('T')[0];
    
    const filteredShifts = Store.shifts.filter(s => {
        const rawRole = String(s.role || s.Role || "").toUpperCase();
        if (rawRole === 'MANAGER') return false;

        const rawDate = String(s.date || s.Date || s.DATE || "").trim();
        if (!rawDate) return true; 
        return rawDate.substring(0, 10) === lookupDate;
    });
    
    const pendingProjects = Store.employees.filter(e => {
        const proj = String(e.specialProject || e.SpecialProject || "").trim();
        const status = String(e.specialProjectStatus || e.SpecialProjectStatus || "").trim().toLowerCase();
        return proj !== "" && (status.includes("pending") || status.includes("completed"));
    });

    container.innerHTML = `
        <div class="card" style="margin-bottom: 1.5rem;">
            <h3 style="color: #1e3a8a; margin-top: 0;">📊 Shift Manager Dashboard & Oversight</h3>
            <p style="font-size: 0.85rem; color: #64748b;">Assign line positions and review completed employee shift reports. Click any row to audit checklist details.</p>
        </div>

        <!-- SPECIAL PROJECT WIDGET FIRST -->
        <div id="special-project-widget-container"></div>

        <!-- MANAGER COOK ASSIGNMENT WIDGET PLACED BELOW SPECIAL PROJECT WIDGET -->
        <div id="mgr-cook-widget-box" style="margin-bottom: 1.5rem;"></div>
        
        <div class="card" style="margin-top: 1.5rem; margin-bottom: 1.5rem; background: #fdf8f6; border: 1px solid #fed7aa;">
            <h4 style="color: #c2410c; margin-top: 0;">🛠️ Pending Special Project Sign-Offs</h4>
            <table class="data-table" style="width: 100%; margin-top: 1rem;">
                <thead>
                    <tr>
                        <th>Employee</th>
                        <th>Assigned Project / Task</th>
                        <th>Status</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${pendingProjects.length === 0 ? `<tr><td colspan="4" style="text-align: center; color: #64748b;">No pending special projects requiring sign-off.</td></tr>` : pendingProjects.map(e => {
                        const statusStr = String(e.specialProjectStatus || e.SpecialProjectStatus || "");
                        const isSignedOff = statusStr.toLowerCase().includes("signed off");

                        return `
                            <tr>
                                <td><strong>${e.name || e.Name}</strong></td>
                                <td>${e.specialProject || e.SpecialProject}</td>
                                <td><span style="color: ${isSignedOff ? '#166534' : '#c2410c'}; font-weight: bold;">${statusStr || 'Pending Review'}</span></td>
                                <td>
                                    ${isSignedOff ? '<span style="color: #166534; font-weight: bold; font-size: 0.8rem;">✅ Signed Off</span>' : `<button class="btn btn-primary" style="padding: 3px 8px; font-size: 0.75rem;" onclick="managerSignOffSpecialProject('${e.id || e.ID}')">Sign Off ✍️</button>`}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>

        <div class="card" style="margin-top: 1.5rem; margin-bottom: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 1rem;">
                <h4 style="color: #1e3a8a; margin: 0;">⭐ Team Shift Audits (Cooks)</h4>
                <div>
                    <label style="font-weight: 600; font-size: 0.85rem; margin-right: 6px;">Lookup Date:</label>
                    <input type="date" id="manager-calendar-lookup-date" class="form-control" value="${lookupDate}" onchange="handleShiftCalendarLookup(this.value)" style="display: inline-block; width: auto; margin-bottom: 0;">
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
                        <th>Status (Tier)</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredShifts.length === 0 ? `<tr><td colspan="7" style="text-align: center; color: #64748b;">No completed cook shift records found for ${lookupDate}.</td></tr>` : filteredShifts.map(s => {
                        const sDate = s.date || s.Date || s.DATE || '';
                        const sName = s.empName || s.EmpName || s.EMPNAME || 'Staff';
                        const sRole = String(s.role || s.Role || s.ROLE || '').toUpperCase();
                        const sStation = s.station || s.Station || s.STATION || 'General';
                        
                        let tasks = s.tasks || s.Tasks || [];
                        if (typeof s.notes === 'string' && s.notes.startsWith('[')) {
                            try { tasks = JSON.parse(s.notes); } catch(e) {}
                        }
                        const totalTasks = Number(s.totalTasks || s.TotalTasks || tasks.length || 15);
                        const tasksCompleted = Number(s.tasksCompleted || s.TasksCompleted || tasks.filter(t => t.completed || t.checked).length);

                        let sScore = Number(s.scorePct || s.ScorePct || s.SCOREPCT || 0);
                        if (sScore === 0 && totalTasks > 0 && tasksCompleted > 0) {
                            sScore = Math.round((tasksCompleted / totalTasks) * 100);
                        }

                        let sTier = s.status || s.Status || '';
                        if (!sTier || sTier === 'Completed' || sTier === 'Needs Review' || sTier === 'Pending Review' || sScore > 0) {
                            if (tasksCompleted >= 13) sTier = "Gold 🥇";
                            else if (tasksCompleted >= 10) sTier = "Silver 🥈";
                            else if (tasksCompleted >= 8) sTier = "Bronze 🥉";
                            else sTier = "Needs Improvement ⚠️";
                        }

                        const isSignedOff = s.managerSignOff === true || String(s.managerSignOff).toLowerCase() === 'true' || s.ManagerSignOff === true;
                        const sId = s.id || s.ID || '';

                        return `
                            <tr onclick="openShiftChecklistModal('${sId}')" style="cursor: pointer;" title="Click to view full checklist audit">
                                <td>${sDate}</td>
                                <td><strong>${sName}</strong></td>
                                <td>${sRole}</td>
                                <td>${sStation}</td>
                                <td><strong>${sScore}%</strong> (${tasksCompleted}/${totalTasks})</td>
                                <td><span style="font-weight: bold; color: #1e3a8a;">${sTier}</span></td>
                                <td onclick="event.stopPropagation()">
                                    ${isSignedOff ? '<span style="color: #166534; font-weight: bold; font-size: 0.8rem;">✅ Signed Off</span>' : `<button class="btn btn-primary" style="padding: 3px 8px; font-size: 0.75rem;" onclick="managerSignOffShift('${sId}')">Sign Off ✍️</button>`}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
        <div id="message-board-container"></div>`;
        
    renderMessageBoard();
    renderSpecialProjectWidget();
    renderManagerAssignmentWidget('mgr-cook-widget-box');
}
function handleShiftCalendarLookup(dateVal) {
    if (!dateVal) return;
    Store.selectedShiftDate = dateVal.trim().split('T')[0];
    
    // Check active role and route to the correct dashboard renderer
    const currentRole = String(Store.role || (Store.user && Store.user.role) || "").trim().toLowerCase();
    
    if (currentRole === 'gm' || currentRole.includes('general')) {
        renderGMDashboard();
    } else {
        renderManagerDashboard();
    }
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
    const endDate = new Date(startDate); 
    endDate.setDate(endDate.getDate() + 13);
    
    const cycleShifts = Store.shifts.filter(s => { 
        const rawDate = String(s.date || s.Date || s.DATE || "").trim();
        if (!rawDate) return false;
        const d = new Date(rawDate.substring(0, 10)); 
        return d >= startDate && d <= endDate; 
    });

    const cookShifts = cycleShifts.filter(s => String(s.role || s.ROLE || "").toUpperCase() !== 'MANAGER');
    
    const dailyCompliance = {};
    for (let i = 0; i < 14; i++) {
        const curr = new Date(startDate); 
        curr.setDate(curr.getDate() + i);
        dailyCompliance[curr.toISOString().split('T')[0]] = { total: 0, sum: 0 };
    }
    cookShifts.forEach(s => { 
        const rawDate = String(s.date || s.Date || s.DATE || "").trim();
        if (!rawDate) return;
        const sDateStr = rawDate.substring(0, 10);
        if (dailyCompliance[sDateStr]) { 
            dailyCompliance[sDateStr].total += 1; 
            dailyCompliance[sDateStr].sum += Number(s.scorePct || s.ScorePct || s.SCOREPCT || 0); 
        } 
    });

    const employeeAverages = {};
    Store.employees.forEach(emp => {
        const eId = String(emp.id || emp.ID || "").trim();
        const eShifts = cookShifts.filter(s => String(s.empId || s.EmpId || s.EMPID || "").trim() === eId);
        if (eShifts.length > 0) {
            const totalScore = eShifts.reduce((acc, s) => acc + Number(s.scorePct || s.ScorePct || s.SCOREPCT || 0), 0);
            employeeAverages[eId] = { name: emp.name || emp.Name || "Staff", avg: Math.round(totalScore / eShifts.length), shiftsCount: eShifts.length };
        }
    });

    if (!Store.selectedShiftDate) {
        Store.selectedShiftDate = (() => {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        })();
    }

    const lookupDate = String(Store.selectedShiftDate || "").trim().split('T')[0];
    
    const filteredShifts = Store.shifts.filter(s => {
        const rawDate = String(s.date || s.Date || s.DATE || "").trim();
        if (!rawDate) return true;
        return rawDate.substring(0, 10) === lookupDate;
    });

    const filteredCookShifts = filteredShifts.filter(s => String(s.role || s.ROLE || "").toUpperCase() !== 'MANAGER');
    const filteredManagerShifts = filteredShifts.filter(s => String(s.role || s.ROLE || "").toUpperCase() === 'MANAGER');

    container.innerHTML = `
        <div class="card" style="margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div>
                <h3 style="color: #1e3a8a; margin-top: 0;">📈 General Manager Executive Suite & Bonus Program</h3>
                <p style="font-size: 0.85rem; color: #64748b; margin: 0;">14-Day compliance tracking cycle & Operational Oversight.</p>
            </div>
            <div>
                <button class="btn btn-secondary" style="color: #dc2626; border: 1px solid #dc2626;" onclick="executeMasterReset()">⚠️ Master Reset All Data</button>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
            <div class="card" style="text-align: center;"><span style="font-size: 0.85rem; color: #64748b;">Active Team Members</span><h2 style="color: #1e3a8a; margin: 5px 0 0 0;">${Store.employees.length}</h2></div>
            <div class="card" style="text-align: center;"><span style="font-size: 0.85rem; color: #64748b;">Total Shifts Logged (Cycle)</span><h2 style="color: #1e3a8a; margin: 5px 0 0 0;">${cycleShifts.length}</h2></div>
            <div class="card" style="text-align: center;"><span style="font-size: 0.85rem; color: #64748b;">Pending Cert Sign-Offs</span><h2 style="color: #dc2626; margin: 5px 0 0 0;">${pendingCerts.length}</h2></div>
        </div>

        <!-- MANAGER ON DUTY ASSIGNMENT WIDGET IN GM SUITE -->
        <div id="gm-mod-widget-box" style="margin-bottom: 1.5rem;"></div>

        <!-- SPECIAL PROJECT WIDGET IN GM SUITE -->
        <div id="special-project-widget-container" style="margin-bottom: 1.5rem;"></div>

        <!-- COOK ASSIGNMENT WIDGET PLACED BELOW SPECIAL PROJECT WIDGET -->
        <div id="gm-cook-widget-box" style="margin-bottom: 1.5rem;"></div>

        <div class="card" style="margin-bottom: 1.5rem;">
            <h4 style="color: #1e3a8a; margin-top: 0;">📊 14-Day Compliance Tracking Trend</h4>
            <div style="display: flex; gap: 6px; align-items: flex-end; height: 180px; padding: 20px 10px 10px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; overflow-x: auto; margin-top: 1rem;">
                ${Object.entries(dailyCompliance).map(([date, stats]) => {
                    const avg = stats.total > 0 ? Math.round(stats.sum / stats.total) : 0;
                    return `<div style="flex: 1; display: flex; flex-direction: column; align-items: center; min-width: 35px; height: 100%; justify-content: flex-end;"><span style="font-size: 0.7rem; font-weight: bold; color: #1e3a8a; margin-bottom: 4px;">${avg}%</span><div style="width: 100%; background: #2563eb; border-radius: 4px 4px 0 0; height: Math.max(avg,5)%;"></div><span style="font-size:0.65rem;color:#64748b;margin-top:6px;transform:rotate(-35deg);">${date.slice(5)}</span></div>`;
                }).join('')}
            </div>
        </div>

        <!-- TEAM COOK SHIFT AUDITS TABLE -->
        <div class="card" style="margin-bottom: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 1rem;">
                <h4 style="color: #1e3a8a; margin: 0;">⭐ Team Shift Audits (Cooks)</h4>
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
                        <th>Status (Tier)</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredCookShifts.length === 0 ? `<tr><td colspan="7" style="text-align: center; color: #64748b;">No completed cook shift records found for ${lookupDate}.</td></tr>` : filteredCookShifts.map(s => {
                        const sDate = s.date || s.Date || s.DATE || '';
                        const sName = s.empName || s.EmpName || s.EMPNAME || 'Staff';
                        const sRole = String(s.role || s.Role || s.ROLE || '').toUpperCase();
                        const sStation = s.station || s.Station || s.STATION || 'General';
                        
                        let tasks = s.tasks || s.Tasks || [];
                        if (typeof s.notes === 'string' && s.notes.startsWith('[')) {
                            try { tasks = JSON.parse(s.notes); } catch(e) {}
                        }
                        const totalTasks = Number(s.totalTasks || s.TotalTasks || tasks.length || 15);
                        const tasksCompleted = Number(s.tasksCompleted || s.TasksCompleted || tasks.filter(t => t.completed || t.checked).length);

                        let sScore = Number(s.scorePct || s.ScorePct || s.SCOREPCT || 0);
                        if (sScore === 0 && totalTasks > 0 && tasksCompleted > 0) {
                            sScore = Math.round((tasksCompleted / totalTasks) * 100);
                        }

                        let sTier = s.status || s.Status || '';
                        if (!sTier || sTier === 'Completed' || sTier === 'Needs Review' || sTier === 'Pending Review' || sScore > 0) {
                            if (tasksCompleted >= 13) sTier = "Gold 🥇";
                            else if (tasksCompleted >= 10) sTier = "Silver 🥈";
                            else if (tasksCompleted >= 8) sTier = "Bronze 🥉";
                            else sTier = "Needs Improvement ⚠️";
                        }

                        const isSignedOff = s.managerSignOff === true || String(s.managerSignOff).toLowerCase() === 'true' || s.ManagerSignOff === true;
                        const sId = s.id || s.ID || '';

                        return `
                            <tr onclick="openShiftChecklistModal('${sId}')" style="cursor: pointer;" title="Click to view full checklist audit">
                                <td>${sDate}</td>
                                <td><strong>${sName}</strong></td>
                                <td>${sRole}</td>
                                <td>${sStation}</td>
                                <td><strong>${sScore}%</strong> (${tasksCompleted}/${totalTasks})</td>
                                <td><span style="font-weight: bold; color: #1e3a8a;">${sTier}</span></td>
                                <td onclick="event.stopPropagation()">
                                    ${isSignedOff ? '<span style="color: #166534; font-weight: bold; font-size: 0.8rem;">✅ Signed Off</span>' : `<button class="btn btn-primary" style="padding: 3px 8px; font-size: 0.75rem;" onclick="managerSignOffShift('${sId}')">Sign Off ✍️</button>`}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>

        <!-- MANAGER SHIFT AUDITS SECTION (GM DASHBOARD ONLY) -->
        <div class="card" style="margin-bottom: 1.5rem; border-left: 4px solid #1e3a8a;">
            <h4 style="color: #1e3a8a; margin-top: 0;">📋 Manager Shift Audits (MOD Oversight)</h4>
            <p style="font-size: 0.85rem; color: #64748b;">Review, score, and audit Manager on Duty (MOD) opening and closing checklists.</p>
            <table class="data-table" style="width: 100%; margin-top: 1rem;">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Manager Name</th>
                        <th>Checklist Type</th>
                        <th>Score</th>
                        <th>Tier Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredManagerShifts.length === 0 ? `<tr><td colspan="6" style="text-align: center; color: #64748b;">No manager checklist audits assigned for ${lookupDate}.</td></tr>` : filteredManagerShifts.map(s => {
                        const sDate = s.date || s.Date || '';
                        const sName = s.empName || s.EmpName || 'Manager';
                        const sStation = s.station || s.Station || 'Manager Checklist';
                        
                        let tasks = s.tasks || s.Tasks || [];
                        if (typeof s.notes === 'string' && s.notes.startsWith('[')) {
                            try { tasks = JSON.parse(s.notes); } catch(e) {}
                        }
                        const totalTasks = Number(s.totalTasks || s.TotalTasks || tasks.length || 15);
                        const tasksCompleted = Number(s.tasksCompleted || s.TasksCompleted || tasks.filter(t => t.completed || t.checked).length);

                        let sScore = Number(s.scorePct || s.ScorePct || 0);
                        if (sScore === 0 && totalTasks > 0 && tasksCompleted > 0) {
                            sScore = Math.round((tasksCompleted / totalTasks) * 100);
                        }

                        let sTier = s.status || s.Status || '';
                        if (!sTier || sTier === 'Completed' || sTier === 'Needs Review' || sTier === 'Pending Review' || sScore > 0) {
                            if (tasksCompleted >= 13) sTier = "Gold 🥇";
                            else if (tasksCompleted >= 10) sTier = "Silver 🥈";
                            else if (tasksCompleted >= 8) sTier = "Bronze 🥉";
                            else sTier = "Needs Improvement ⚠️";
                        }

                        const isSignedOff = s.managerSignOff === true || String(s.managerSignOff).toLowerCase() === 'true';
                        const sId = s.id || s.ID || '';

                        return `
                            <tr onclick="openShiftChecklistModal('${sId}')" style="cursor: pointer;" title="Click to open GM scoring & audit modal">
                                <td>${sDate}</td>
                                <td><strong>${sName}</strong></td>
                                <td>${sStation}</td>
                                <td><strong>${sScore}%</strong> (${tasksCompleted}/${totalTasks})</td>
                                <td><span style="font-weight: bold; color: #1e3a8a;">${sTier}</span></td>
                                <td onclick="event.stopPropagation()">
                                    ${isSignedOff ? '<span style="color: #166534; font-weight: bold; font-size: 0.8rem;">✅ Signed Off</span>' : `<button class="btn btn-primary" style="padding: 3px 8px; font-size: 0.75rem;" onclick="managerSignOffShift('${sId}')">Sign Off ✍️</button>`}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>

        <div class="card" style="margin-bottom: 1.5rem;">
            <h4 style="color: #1e3a8a; margin-top: 0;">🎓 Pending Training Certifications for Approval</h4>
            <table class="data-table" style="width: 100%; margin-top: 1rem;">
                <thead>
                    <tr><th>Employee ID</th><th>Module ID</th><th>Score</th><th>Action</th></tr>
                </thead>
                <tbody>
                    ${pendingCerts.length === 0 ? `<tr><td colspan="4" style="text-align: center; color: #64748b;">No pending certifications.</td></tr>` : pendingCerts.map(c => `<tr><td>${c.empId || c.EMPID}</td><td>${c.modId || c.MODID}</td><td>${c.score}%</td><td><button class="btn btn-primary" style="padding: 4px 10px; font-size: 0.8rem;" onclick="gmSignOffCert('${c.empId || c.EMPID}','${c.modId || c.MODID}')">Approve ✅</button></td></tr>`).join('')}
                </tbody>
            </table>
        </div>`;

    renderGMManagerAssignmentWidget('gm-mod-widget-box');
    renderSpecialProjectWidget();
    renderManagerAssignmentWidget('gm-cook-widget-box');
}
function openShiftChecklistModal(shiftId) {
    const shift = Store.shifts.find(s => String(s.id || s.ID) === String(shiftId));
    if (!shift) {
        alert("Shift record details not found.");
        return;
    }

    const modalBody = document.getElementById('shift-modal-overlay');
    if (!modalBody) return;

    const isSignedOff = shift.managerSignOff === true || String(shift.managerSignOff).toLowerCase() === 'true';
    const isGMRole = Store.role === 'gm';
    const roleStr = String(shift.role || shift.Role || "").toUpperCase();
    const isManagerShift = roleStr === 'MANAGER';

    // PERMISSION LOGIC:
    // - Cook Shifts: Both Managers and GM can score and sign off.
    // - Manager Shifts: ONLY the General Manager has audit-level scoring and sign-off clearance.
    let canEdit = false;
    if (!isSignedOff) {
        if (!isManagerShift) {
            canEdit = Store.role === 'manager' || isGMRole;
        } else {
            canEdit = isGMRole;
        }
    }

    let rawTasks = shift.tasks || shift.Tasks || shift.checklistItems || shift.Items || shift.items;
    if (!rawTasks && shift.notes && typeof shift.notes === 'string' && shift.notes.startsWith('[')) {
        try { rawTasks = JSON.parse(shift.notes); } catch (e) { rawTasks = []; }
    }

    let tasks = Array.isArray(rawTasks) ? rawTasks.map(t => {
        const label = typeof t === 'string' ? t : (t.label || t.name || t.text || '');
        const isDone = t.completed === true || t.checked === true || String(t.status).toLowerCase() === 'completed';
        return { label: label, completed: isDone, checked: isDone };
    }) : [];

    shift.tasks = tasks;

    let tasksListHTML = "";
    if (tasks.length > 0) {
        tasksListHTML = tasks.map((t, idx) => {
            const isChecked = t.completed || t.checked;
            const isDisabled = !canEdit;
            return `
                <div style="display: flex; align-items: flex-start; gap: 10px; padding: 10px 0; border-bottom: 1px solid #f1f5f9;">
                    <input type="checkbox" 
                           style="width: 18px; height: 18px; margin-top: 2px; cursor: ${isDisabled ? 'not-allowed' : 'pointer'};" 
                           ${isChecked ? 'checked' : ''} 
                           ${isDisabled ? 'disabled' : ''}
                           onchange="toggleShiftTaskAudit('${shift.id || shift.ID}', ${idx}, this.checked)">
                    <div style="flex: 1;">
                        <span style="font-size: 0.9rem; color: #1e293b; font-weight: 500;">${t.label}</span>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        tasksListHTML = `<div style="padding: 15px; text-align: center; color: #64748b;">No checklist tasks found.</div>`;
    }

    const totalTasks = tasks.length;
    const completedCount = tasks.filter(t => t.completed || t.checked).length;
    const currentScore = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
    const pointsEarned = completedCount * 10;

    let initialTier = "Needs Improvement ⚠️";
    if (completedCount >= 13) initialTier = "Gold 🥇";
    else if (completedCount >= 10) initialTier = "Silver 🥈";
    else if (completedCount >= 8) initialTier = "Bronze 🥉";

    document.getElementById('shift-modal-body').innerHTML = `
        <div style="border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 15px;">
            <h3 style="color: #1e3a8a; margin: 0 0 5px 0;">📋 Shift Audit: ${shift.empName || shift.EmpName || 'Staff'}</h3>
            <p style="font-size: 0.85rem; color: #64748b; margin: 0;">Role: <strong>${shift.role || 'Staff'}</strong> | Station/Type: <strong>${shift.station || shift.Station || 'General'}</strong> | Date: ${shift.date || shift.Date}</p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 15px; background: #f8fafc; padding: 10px; border-radius: 6px;">
            <div><span style="font-size: 0.8rem; color: #64748b;">Completion Score:</span><br><strong id="modal-live-score">${currentScore}% (${completedCount}/${totalTasks} tasks | ${pointsEarned} pts)</strong></div>
            <div><span style="font-size: 0.8rem; color: #64748b;">Tier Status:</span><br><strong id="modal-live-status">${initialTier}</strong></div>
        </div>

        <h4 style="color: #1e3a8a; margin-bottom: 8px;">Checklist Audit Items ${!canEdit ? '(Read-Only View)' : '(GM Audit Scoring)'}</h4>
        <div style="max-height: 250px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0 10px; margin-bottom: 15px; background: #ffffff;">
            ${tasksListHTML}
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 15px;">
            <button class="btn btn-secondary" onclick="closeShiftChecklistModal(); UIController.refreshActiveView();">Close</button>
            ${isSignedOff ? 
                '<span style="color: #166534; font-weight: bold; align-self: center;">✅ Signed Off</span>' : 
                (canEdit ? `<button class="btn btn-primary" onclick="managerSignOffShift('${shift.id || shift.ID}'); closeShiftChecklistModal(); UIController.refreshActiveView();">Sign Off Shift ✍️</button>` : '<span style="color: #64748b; font-size: 0.85rem; align-self: center;">🔒 Read-Only (Restricted to General Manager)</span>')
            }
        </div>
    `;

    modalBody.style.display = 'flex';
}
function toggleShiftTaskAudit(shiftId, taskIndex, isChecked) {
    const shift = Store.shifts.find(s => String(s.id || s.ID) === String(shiftId));
    if (!shift) return;

    let tasks = shift.tasks || shift.Tasks || [];
    if (typeof tasks === 'string') {
        try { tasks = JSON.parse(tasks); } catch (e) { tasks = []; }
    }

    if (Array.isArray(tasks) && tasks[taskIndex]) {
        tasks[taskIndex].completed = isChecked;
        tasks[taskIndex].checked = isChecked;
        shift.tasks = tasks; 
        shift.notes = JSON.stringify(tasks);
    }

    if (Array.isArray(tasks) && tasks.length > 0) {
        const completedCount = tasks.filter(t => t.completed || t.checked).length;
        const totalTasks = tasks.length;
        
        const pointsEarned = completedCount * 10;
        const percentageScore = Math.round((completedCount / totalTasks) * 100);
        
        // Tier Evaluation Logic
        let tierLabel = "Needs Improvement ⚠️";
        if (completedCount >= 13) tierLabel = "Gold 🥇";
        else if (completedCount >= 10) tierLabel = "Silver 🥈";
        else if (completedCount >= 8) tierLabel = "Bronze 🥉";

        shift.scorePct = percentageScore;
        shift.ScorePct = percentageScore;
        shift.tasksCompleted = completedCount;
        shift.totalTasks = totalTasks;
        shift.pointsEarned = pointsEarned;
        shift.totalPointsPossible = totalTasks * 10;
        shift.status = tierLabel;
        shift.Status = tierLabel;

        // Update modal live view text
        const scoreEl = document.getElementById('modal-live-score');
        const statusEl = document.getElementById('modal-live-status');
        if (scoreEl) scoreEl.innerText = `${percentageScore}% (${completedCount}/${totalTasks} tasks | ${pointsEarned} pts)`;
        if (statusEl) statusEl.innerText = tierLabel;

        // Concurrently update background dashboard table
        const currentRole = String(Store.role || "").trim().toLowerCase();
        if (currentRole === 'gm' || currentRole.includes('general')) {
            if (typeof renderGMDashboard === 'function') renderGMDashboard();
        } else {
            if (typeof renderManagerDashboard === 'function') renderManagerDashboard();
        }
    }
}
function closeShiftChecklistModal() {
    document.getElementById('shift-modal-overlay').style.display = 'none';
}
function executeMasterReset() {
    if (Store.role !== 'gm') return;
    if (confirm("⚠️ WARNING: This will clear all local application data, shifts, messages, and reset system records. Are you sure you want to proceed?")) {
        Store.employees = [];
        Store.shifts = [];
        Store.certifications = [];
        Store.messages = [];
        Store.recipes = [];
        ApiService.request('masterReset', {}).then(() => {
            alert("Master reset completed successfully.");
            UIController.refreshActiveView();
        }).catch(() => {
            alert("Master reset executed locally.");
            UIController.refreshActiveView();
        });
    }
}

function gmSignOffCert(empId, modId) {
    const cert = Store.certifications.find(c => String(c.empId || c.EMPID).trim() === String(empId).trim() && String(c.modId || c.MODID).trim() === String(modId).trim());
    if (!cert) return;
    cert.managerSignOff = true;
    ApiService.request('saveCert', { cert }).then(() => { renderGMDashboard(); alert("Certification approved!"); });
}

function renderRosterView() {
    const rosterViewEl = document.getElementById('view-roster');
    if (!rosterViewEl) return;

    const isGM = Store.role === 'gm';
    rosterViewEl.innerHTML = `
        <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 1rem;">
                <h3 style="color: var(--primary); margin: 0;">👥 Staff Roster & Onboarding Directory</h3>
                ${isGM ? `<button class="btn btn-primary" onclick="openEmployeeModal()">Add Employee ➕</button>` : ''}
            </div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Role</th>
                        <th>Assigned Station</th>
                        <th>Hourly Rate</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="roster-table-body">
                </tbody>
            </table>
        </div>
    `;

    const tbody = document.getElementById('roster-table-body');
    if (!tbody) return;
    const uniqueEmployees = Array.from(new Map(Store.employees.map(emp => [String(emp.id || emp.ID).trim(), emp])).values());
    tbody.innerHTML = uniqueEmployees.length === 0 ? `<tr><td colspan="6" style="text-align: center; color: #64748b;">No employees found.</td></tr>` :
        uniqueEmployees.map(emp => {
            const eId = emp.id || emp.ID;
            return `<tr><td>${eId}</td><td><strong>${emp.name || emp.Name}</strong></td><td>${String(emp.role || emp.Role || 'cook').toUpperCase()}</td><td>${emp.station || emp.Station || 'General'}</td><td>$${emp.hourlyRate || emp.HourlyRate || '0.00'}</td><td>${isGM ? `<div style="display: flex; gap: 6px;"><button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.8rem;" onclick="openEmployeeModal('${eId}')">Edit ✏️</button><button class="btn btn-secondary" style="color: #dc2626; padding: 4px 8px; font-size: 0.8rem;" onclick="deleteEmployee('${eId}')">Delete 🗑️</button></div>` : ''}</td></tr>`;
        }).join('');
}

function openEmployeeModal(empId) {
    if (Store.role !== 'gm') return;
    let existing = null;
    if (empId) { existing = Store.employees.find(e => String(e.id || e.ID).trim() === String(empId).trim()); }
    const name = prompt("Enter employee name:", existing ? (existing.name || existing.Name || '') : '');
    if (!name) return;

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

function loadGlobalAppData() {
    ApiService.request('getAppData', {}).then(response => {
        if (response && response.success) {
            Store.shifts = response.shifts || [];
            Store.employees = response.employees || [];
            Store.certifications = response.certifications || [];
            Store.messages = response.messages || [];
            Store.recipes = response.recipes || [];
            Store.approvals = response.approvals || [];
            
            localStorage.setItem('kitchenSyncGlobalStore', JSON.stringify({
                shifts: Store.shifts,
                employees: Store.employees,
                certifications: Store.certifications,
                messages: Store.messages,
                recipes: Store.recipes,
                approvals: Store.approvals
            }));

            if (typeof UIController !== 'undefined' && UIController.refreshActiveView) {
                UIController.refreshActiveView();
            } else if (typeof renderActiveDashboard === 'function') {
                renderActiveDashboard();
            }
        }
    }).catch(err => {
        console.error("Failed to load global cloud data:", err);
        const cached = localStorage.getItem('kitchenSyncGlobalStore');
        if (cached) {
            const parsed = JSON.parse(cached);
            Store.shifts = parsed.shifts || [];
            Store.employees = parsed.employees || [];
            Store.certifications = parsed.certifications || [];
            Store.messages = parsed.messages || [];
            Store.recipes = parsed.recipes || [];
            Store.approvals = parsed.approvals || [];
        }
    });
}

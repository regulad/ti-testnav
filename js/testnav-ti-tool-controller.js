var controller;
var isSecure = function() {
    return true;
};

var onTICalcReady = function(evt) {
    $(document).trigger('tn.loadingModal.off');
    window.app && loading.modal('hide');
    // We need to do clean up of TI Calcs on certain corner cases where it was observed the Calcs showing up
    // after a focus out event. Jira issue - TNAV-3435
    $(document).trigger('CalcDestroyOnLostFocus');
    // This is hopefully a temporary fix. The TI calcs try to set their coupling before the deep zoom tool menu
    // closes it's coupling on subsequent visits to the same TI calc in deep zoom.
    window.tiCalcInstance.focus();
    window.tiCalcInstance.monitorDeepZoom();
};

function cleanupCalculator() {
    // Cleanup existing calculator
    $(document).trigger("unloadTICalc");
    if (window.tiCalcInstance) {
        $("#calculatorDiv") && $("#calculatorDiv").removeClass(window.tiCalcInstance.name);
        clearInterval(window.tiCalcInstance.interval);
        window.tiCalcInstance.remove();
    }
    window.tiCalcInstance = null;
    ["TI30", "TI30_lcd", "TI84", "TI84_lcd", "TI108", "TI108_lcd"].forEach(function(tiglobal) {
        window[tiglobal] = null;
    });
}

function createCalculator(calcType) {
    cleanupCalculator();
    // Create new calculator
    controller = TIControllerAPI && TIControllerAPI.createToolController();
    window.tiCalcInstance = new controller[calcType]();
    $(document).off(window.tiCalcInstance.readyEvent, onTICalcReady)
        .one(window.tiCalcInstance.readyEvent, onTICalcReady);
    window.tiCalcInstance.initialize(isSecure());
}

// check to see if we loaded with a ti calc name
const urlSearchParamters = new URLSearchParams(window.location.search);
const maybeCalculatorName = urlSearchParamters.get("c");
if (maybeCalculatorName && maybeCalculatorName.length > 0) {
    createCalculator(maybeCalculatorName.toUpperCase());
}

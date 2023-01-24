const TN8 = {
    baseUrl: window.document.location.origin + "/",
    throw: function(errorString, errorCode) {
        console.warn(errorString);
        console.warn(`Code: ${errorCode}`);
    },
    errorType: {
        TI84_LOAD_ERROR: 84,
        TI30_LOAD_ERROR: 30,
        TI108_LOAD_ERROR: 108
    }
}
window.TN8 = TN8;

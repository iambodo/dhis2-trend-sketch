/** @type {import('@dhis2/cli-app-scripts').D2Config} */
module.exports = {
    type: 'app',
    name: 'dhis2-trend-sketch',
    title: 'DHIS2 Trend Sketch',

    entryPoints: {
        plugin: './src/Plugin.jsx',
    },

    pluginType: 'DASHBOARD',
}
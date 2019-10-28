/**
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */
/* global console, requirejs */

/**
 * This module extends the notebook to allow dashboard creation and viewing.
 */
define([
    'jquery',
    'require',
    './polymer-support',
    '../link-css'
], function(
    $,
    require,
    PolymerSupport,
    linkCSS
) {
    'use strict';

    // use global require.js to setup the paths for our dependencies
    requirejs.config({
        packages: [
            { name: 'dashboard-common', location: require.toUrl('../dashboard-common').split('?')[0] }
        ],
        paths: {
            lodash: require.toUrl('../bower_components/lodash/lodash').split('?')[0],
            text: require.toUrl('../bower_components/requirejs-text/text').split('?')[0],
            template: require.toUrl('./template-loader').split('?')[0],
            gridstack: require.toUrl('../bower_components/gridstack/dist/gridstack').split('?')[0],
            'gridstack.jqueryui': require.toUrl('../bower_components/gridstack/dist/gridstack.jQueryUI').split('?')[0]
            // jquery-ui is already loaded by Notebook, as 'jqueryui' in 4.0.x and 'jquery-ui' in 4.1.x
        },
        map: {
            // Gridstack uses jquery-ui 1.11 (supports AMD) while notebook uses 1.10 (non-amd).
            // Map Gridstack to the old non-AMD jquery-ui used by notebook.
            // We can't just use the 'jqueryui' that is mapped back to 'jquery-ui' in notebook 4.1.x+
            // because requirejs does not recursively apply maps and instead chooses the most
            // specific rule. Here, that would be whatever we set for Gridstack vs whatever notebook
            // set for '*'.
            '*': {
                'jquery-ui/core': require.specified('jquery-ui') ? 'jquery-ui' : 'jqueryui',
                'jquery-ui/mouse': require.specified('jquery-ui') ? 'jquery-ui' : 'jqueryui',
                'jquery-ui/widget': require.specified('jquery-ui') ? 'jquery-ui' : 'jqueryui',
                'jquery-ui/resizable': require.specified('jquery-ui') ? 'jquery-ui' : 'jqueryui',
                'jquery-ui/draggable': require.specified('jquery-ui') ? 'jquery-ui' : 'jqueryui',
                'jquery-ui/data': require.specified('jquery-ui') ? 'jquery-ui' : 'jqueryui',
                'jquery-ui/disable-selection': require.specified('jquery-ui') ? 'jquery-ui' : 'jqueryui',
                'jquery-ui/focusable': require.specified('jquery-ui') ? 'jquery-ui' : 'jqueryui',
                'jquery-ui/form': require.specified('jquery-ui') ? 'jquery-ui' : 'jqueryui',
                'jquery-ui/ie': require.specified('jquery-ui') ? 'jquery-ui' : 'jqueryui',
                'jquery-ui/labels': require.specified('jquery-ui') ? 'jquery-ui' : 'jqueryui',
                'jquery-ui/jquery-1-7': require.specified('jquery-ui') ? 'jquery-ui' : 'jqueryui',
                'jquery-ui/plugin': require.specified('jquery-ui') ? 'jquery-ui' : 'jqueryui',
                'jquery-ui/keycode': require.specified('jquery-ui') ? 'jquery-ui' : 'jqueryui',
                'jquery-ui/safe-active-element': require.specified('jquery-ui') ? 'jquery-ui' : 'jqueryui',
                'jquery-ui/safe-blur': require.specified('jquery-ui') ? 'jquery-ui' : 'jqueryui',
                'jquery-ui/scroll-parent': require.specified('jquery-ui') ? 'jquery-ui' : 'jqueryui',
                'jquery-ui/tabbable': require.specified('jquery-ui') ? 'jquery-ui' : 'jqueryui',
                'jquery-ui/unique-id': require.specified('jquery-ui') ? 'jquery-ui' : 'jqueryui',
                'jquery-ui/version': require.specified('jquery-ui') ? 'jquery-ui' : 'jqueryui',
                'jquery-ui/widgets/mouse': require.specified('jquery-ui') ? 'jquery-ui' : 'jqueryui',
                'jquery-ui/widgets/draggable': require.specified('jquery-ui') ? 'jquery-ui' : 'jqueryui',
                'jquery-ui/widgets/droppable': require.specified('jquery-ui') ? 'jquery-ui' : 'jqueryui',
                'jquery-ui/widgets/resizable': require.specified('jquery-ui') ? 'jquery-ui' : 'jqueryui'
            }
        }
    });

    linkCSS('./dashboard-view/dashboard-actions.css');
    linkCSS('./dashboard-common/dashboard-common.css');
    linkCSS('./dashboard-view/dashboard-view.css');

    var dashboard;
    var $helpArea;
    function getLayout(dbActions, module, opts) {
        return {
            module: module,
            opts: $.extend({
                $container: $('#notebook-container'),
                scrollContainer: $('#site').get(0),
                exit: function() {
                    dbActions.switchToNotebook();
                }
            }, opts)
        };
    }

    PolymerSupport.init();

    // dashboard-actions depends on requirejs text plugin
    require([
        'base/js/namespace',
        './dashboard-actions',
        './dashboard-metadata',
        './dashboard-metadata-compatibility'
    ], function(
        Jupyter,
        DashboardActions,
        Metadata,
        Compatibility
    ) {
        var dashboardClass = 'jupyter-dashboard';
        if (Jupyter.notebook.metadata.hasOwnProperty('urth')) {
            // convert old metadata spec to new version
            Metadata.initialize();
            Compatibility.convert();
        }
        var dbActions = new DashboardActions({
            enterDashboardMode: function(actionState) {
                $('body').addClass(dashboardClass);
                require([
                    './layout/grid/layout',
                    './layout/report/layout',
                    'template!./help.html'
                ], function(
                    GridLayout,
                    ReportLayout,
                    $helpTemplate
                ) {
                    var LAYOUT = {};
                    LAYOUT[Metadata.DASHBOARD_VIEW.GRID] = getLayout(dbActions, GridLayout, {
                        onResize: PolymerSupport.onResize
                    });
                    LAYOUT[Metadata.DASHBOARD_VIEW.REPORT] = getLayout(dbActions, ReportLayout);

                    if (actionState !== DashboardActions.STATE.NOTEBOOK &&
                        !Metadata.activeView) {
                        // set to grid by default if layout not set
                        Metadata.activeView = Metadata.DASHBOARD_VIEW.GRID;
                    }
                    LAYOUT[DashboardActions.STATE.DASHBOARD_PREVIEW] = LAYOUT[Metadata.activeView];
                    var layout = LAYOUT[actionState];

                    if (dashboard) {
                        // destroy the previous view
                        dashboard.destroy();
                    }
                    // create help area
                    if ($helpArea) {
                        // remove if it exists since layout-specific help text will be inserted
                        // note: we assume this cleans up all descendant event handlers (according to
                        // the jquery source and various online doc)
                        $helpArea.remove();
                    }
                    $helpArea = $helpTemplate.clone().prependTo($('#notebook_panel'));
                    var layoutHelpText = layout.module.helpText;
                    if (layoutHelpText) {
                        // insert layout-specific help text
                        if (layoutHelpText.snippet) {
                            $helpArea.find('.help-snippet-text').text(layoutHelpText.snippet);
                        }
                        var layoutHelpDetails = layoutHelpText.details;
                        if (layoutHelpDetails) {
                            var $firstDetail = $helpArea.find('.help-details-list').children().first();
                            Object.keys(layoutHelpDetails).forEach(function(key, i) {
                                $firstDetail.before($('<li>').append(layoutHelpDetails[key]));
                            });
                        }
                    }

                    // instantiate the dashboard
                    dashboard = layout.module.create(layout.opts);
                    dashboard.setInteractive({
                        enable: actionState !== 'preview',
                        complete: function() {
                            PolymerSupport.notifyResizeAll();
                        }
                    });
                    // Metadata.activeView gets set by the layout module
                    $('body').attr('data-dashboard-layout', Metadata.activeView);
                });
            },
            exitDashboardMode: function() {
                $('body').removeClass(dashboardClass)
                         .attr('data-dashboard-layout', '');
                dashboard.destroy();
                dashboard = null;
                PolymerSupport.notifyResizeAll();
                $helpArea.remove();
            },
            showAll: function() {
                dashboard.showAllCells();
            },
            showAllStacked: function() {
                // ok if width is undefined, only grid layout takes an argument
                dashboard.showAllCells({ width : dashboard.numCols });
            },
            hideAll: function() {
                dashboard.hideAllCells();
            }
        });
        dbActions.addMenuItems();
        dbActions.addToolbarItems();
    });
});

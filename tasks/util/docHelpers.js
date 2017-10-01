import config from '../../config';
import { sync as glob } from 'glob';
import { relative, sep } from 'path';
import yaml from 'js-yaml';
import { nunjucks } from 'gulp-nunjucks-render';
import marked from 'marked';
import fs from 'fs';
import { html as htmlBeautify } from 'js-beautify';
import envManager from './envManager';

/**
 * Doc task helper functions
 */
class docsHelpers {

    /**
     * Create nunjucks environment
     * @return {object} environment
     */
    static createEnvironment() {
        const paths = [
            config.docs.src.indexDir,
            config.docs.src.layoutDir,
            config.docs.src.components,
            config.html.src.layoutDir,
            config.html.src.componentsDir
        ];
        const loaders = paths.map(path => new nunjucks.FileSystemLoader(path));
        const environment = new nunjucks.Environment(loaders);
        envManager(environment);

        return environment;
    }

    /**
     * Render component
     * @param {Buffer} content - File content
     * @param {File} file - File object
     * @returns {string} component - rendered component
     */
    static renderComponent(content, file) {
        const environment = docsHelpers.createEnvironment();
        const yml = yaml.load(content);
        const locals = Object.assign(yml.data || '{}', { baseUri: config.html.baseUri });
        let sample = '';

        try {
            sample = htmlBeautify(environment.render(file.path.replace('.yml', '.njk'), locals));
        } catch (error) {
            global.console.log(error);
        }

        const data = {
            title: yml.title,
            description: marked(yml.description || ''),
            implementation: marked(yml.implementation || '').replace('<table', '<table class="table"'),
            demo: file.path.split(sep).pop().replace('.yml', '.demo.html'),
            sample: sample
        };

        return environment.render(config.docs.src.component, data);

    }

    /**
     * Render component demo
     * @param {Buffer} content - File content
     * @param {File} file - File object
     * @returns {string} component - rendered component
     */
    static renderComponentDemo(content, file) {
        const environment = docsHelpers.createEnvironment();
        const yml = yaml.load(content);
        const locals = Object.assign(yml.data || '{}', { baseUri: config.html.baseUri });
        let demo = '';

        try {
            demo = environment.render(file.path.replace('.yml', '.njk'), locals);
            demo = (yml.demo || '{}').replace(/\{\}/g, demo);
        } catch (error) {
            global.console.log(error);
        }

        return environment.render(config.docs.src.preview, { baseUri: config.html.baseUri, demo: demo });

    }

    /**
     * Get relative paths
     * @param {string} globString - glob pattern for the files
     * @param {string} relativeTo - dir name
     * @returns {Array} paths - array of relative paths
     */
    static getRelativePaths(globString, relativeTo) {
        return glob(globString, { nosort: true }).map(dir => relative(relativeTo, dir));
    }

    /**
     * Get the template tree
     * @param {string} globString - glob pattern for the template files
     * @param {string} relativeTo - dir containing the files in globString
     * @returns {Object} tree - object with alle templates and children
     */
    static getTemplateTree(globString, relativeTo) {

        const files = docsHelpers.getRelativePaths(globString, relativeTo);

        return files.reduce((tree, file) => {
            const path = file.split(sep);
            const key = path[0]
                .replace('.njk', '')
                .replace(/[_-]/g, ' ');
            const name = path[path.length - 1]
                .replace('.njk', '')
                .replace(/[_-]/g, ' ');

            tree[key] = tree[key] || {};
            tree[key].variations = tree[key].variations || [];
            tree[key].variations.push({ url: file, name: name });

            return tree;

        }, {});
    }

    /**
     * Get the component tree
     * @param {string} globString - glob pattern for the component files
     * @param {string} relativeTo - dir containing the files in globString
     * @returns {Object} tree - object with alle components and children
     */
    static getComponentTree(globString, relativeTo) {

        const files = docsHelpers.getRelativePaths(globString, relativeTo);

        return files.reduce((tree, file) => {
            const yml = yaml.safeLoad(fs.readFileSync(`${config.docs.src.components}/${file}`)) || false;

            if (typeof yml === 'object') {
                const path = file.split(sep)[0];
                const name = yml.title;

                tree[path] = tree[path] || {};
                tree[path].variations = tree[path].variations || [];
                tree[path].variations.push({ url: file.replace('.yml', '.njk'), name: name });
            }

            return tree;

        }, {});
    }

    /**
     * Check if a yaml file has content
     * @param {VinylObject} file -
     * @returns {Boolean} hasContent -
     */
    static hasContent(file) {
        return typeof yaml.safeLoad(file.contents) === 'object';
    }

}

export default docsHelpers;

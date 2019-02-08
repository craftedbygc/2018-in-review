const webpack = require('webpack')
const path = require('path')
const BrowserSyncPlugin = require('browser-sync-webpack-plugin')

module.exports = {
    entry: './src/main.js',
    output: {
        path: path.resolve(__dirname, 'public/js'),
        publicPath: '/js/',
        filename: 'main.bundle.js'
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /(node_modules|bower_components)/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['env']
                    }
                }
            },
            {
                test: /\.(glsl|frag|vert)$/,
                loader: 'raw-loader',
                exclude: /node_modules/
            },
            {
                test: /\.(glsl|frag|vert)$/,
                loader: 'glslify-loader',
                exclude: /node_modules/
            },
            {
              test: /\.scss$/, // TODO: add vendor prefixes
              use: [
                {
                  loader: "style-loader" // creates style nodes from JS strings
                },
                {
                  loader: "css-loader" // translates CSS into CommonJS
                },
                {
                  loader: "sass-loader" // compiles Sass to CSS
                }
              ]
            }
        ]
    },
    plugins: [
        new webpack.HotModuleReplacementPlugin(), // Enable HMR
        new webpack.NamedModulesPlugin(),
        new BrowserSyncPlugin(
            {
                host: 'localhost',
                port: 3001,
                proxy: 'http://localhost:8080/',
                files: [
                    {
                        match: ['**/*.html'],
                        fn: event => {
                            if (event === 'change') {
                                const bs = require('browser-sync').get(
                                    'bs-webpack-plugin'
                                )
                                bs.reload()
                            }
                        }
                    }
                ]
            },
            {
                reload: false
            }
        )
    ],
    devServer: {
        hot: true, // Tell the dev-server we're using HMR
        contentBase: path.resolve(__dirname, 'public'),
        publicPath: '/js/'
    },
    watch: true,
    devtool: 'cheap-eval-source-map'
}

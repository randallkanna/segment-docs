// A script the check all local links on the docs site

const globby = require('globby')
const posthtml = require('posthtml')
const fs = require('fs')
const server = require('browser-sync').create()
const checkLinks = require('check-links')
const ora = require('ora')


const checkForDeadLocalUrls = async () => {
  try {
    // Grab all the files from the specified directory, add their paths to a new set 
    const files = await globby('_site/**/*.html')
    const throbber = ora('Link Check Starting').start()
    // Use a set here for efficiency, no duplicate values!
    const urls = new Set()

    // Logic for collecting the list of URLs to check
    // If the link starts with `/docs/`, replace that with a localhost:3000 domain, and add it to the list.
    const ph = posthtml([
      require('posthtml-urls')({
        eachURL: (url) => {
          if (url.startsWith('/docs/')) {
            urls.add(url.replace('/docs/', 'http://localhost:3000/'))
          }
        },
      }),
    ])
    throbber.succeed()

    // Using the logic above, iterate through the entire list of files
    throbber.start('Processing files')
    files.forEach((file) => {
      ph.process(fs.readFileSync(file))
    })
    throbber.succeed()

    // Spin up a lightweight browsersync server to check each URL
    throbber.start('Starting server')
    await new Promise((resolve) => {
      server.init({
          port: 3000,
          server: {
            baseDir: '_site',
          },
          open: false,
          logLevel: 'silent',
        },
        resolve,
      )
      throbber.succeed()
    })

    // Check the links against the local browsersync site
    const results = await checkLinks(
      Array.from(urls).map((url) =>
        url
      ),
    )

    // If a link returns 'dead' (404), add it to an array
    const deadUrls = Array.from(urls).filter(
      (url) => results[url].status === 'dead',
    )

    // For ease of checking, replace the localhost domain with the live domain, add those to a new array.
    let broke = []
    deadUrls.forEach(url => {
      link = url.replace('http://localhost:3000', 'https://engage-ga--segment-docs-private.netlify.app/docs')
      if (!link.endsWith('/')){
        link = link+'/'
      }
      broke.push(link)
    });


    // Sometimes, we redirect urls based on jekyll settings, or a setting an app-nginx. 
    // For those, we want to remove them from the list of dead links, because they aren't dead.
    
    // app-nginx redirects
    const redirects = ['https://engage-ga--segment-docs-private.netlify.app/docs/guides/usage-and-billing/','https://engage-ga--segment-docs-private.netlify.app/docs/connections/sources/catalog/libraries/website/plugins/', 'https://engage-ga--segment-docs-private.netlify.app/docs/assets/docs.bundle.js/']
    
    // Redirects generated by Jekyll
    // Pull the redirects json file
    const data = require('../_site/redirects.json')
    // Grab the 'from' redirect
    Object.keys(data).forEach(key => {
      if (!key.endsWith('/')){
        key = key+'/'
      }
      redirects.push('https://engage-ga--segment-docs-private.netlify.app/docs'+key.replace('/docs',''))
    })
    // Remove the redirect urls from the list of broken URLs
    broke = broke.filter(val => !redirects.includes(val));

    // If there are dead URLs, list them here, along with the count. Exit status 1 to indicate an error.

    if (broke.length > 0) {
      throbber.fail(`Dead URLS: ${broke.length}\n\n`)
      console.log(`Dead URLS: ${broke.length}\n\n${broke.join('\n')}`)
      process.exit(1)
    }else {
      console.log('All links work!')
      process.exit
    }
    throbber.stop()
    server.exit()
  } catch (e) {
    console.error(e)
    server.exit()
  }
}

checkForDeadLocalUrls()


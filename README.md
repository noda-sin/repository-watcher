repository-watcher
============

Watching repositories of github organazation members.


## Getting Started

    % export GITHUB_TOKEN=...
    % export GITHUB_ORG=...
    % export SMTP_HOST=...
    % export SMTP_PORT=...
    % export ORG_MAIL_ADDR=...

    % node index.js

    usage: [options] 

		All options should be set with the syntax --option=value

		options:
  		--token    Token     Auth Token of Github.
  		--org      ORG       Target organization watched.
  		--smtpHost HOST      SMTP Server Host.
  		--smtpPort PORT      SMTP Server Port.
  		--mailAddr ADDRESS   e-mail address notified that member created new repository.
  		--interval INTERVAL  interval for watching repositories.
  		--ignore   FILE      JSON File for ignore repositoris list.
  		--proxy    HOST:PORT HTTP Proxy to access Github.
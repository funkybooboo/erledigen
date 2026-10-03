# Security

Erledigen is self-hosted software: you run it on your own infrastructure, and the security of your deployment (network exposure, TLS termination, any authentication layer in front of the API) is part of operating it. By default the compose stacks are meant for a trusted local network, not direct exposure to the internet.

## Reporting a vulnerability

If you find a security issue in Erledigen's code, please report it privately:

*   Use GitHub's **private vulnerability reporting** on the [Security tab](https://github.com/funkybooboo/erledigen/security), or
*   Open a [private security advisory](https://github.com/funkybooboo/erledigen/security/advisories/new).

Please do not open a public issue for anything that could be exploited. Include reproduction steps and affected versions where you can. You will hear back within a few days.
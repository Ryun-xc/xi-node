# Distribution Decision

## Decision

v0.1 does not ship a signed Windows `.exe` installer.

Primary distribution:

```text
Docker Compose
source + Node 20+
```

Optional:

```text
unsigned Windows portable zip
```

## Why

```text
code signing certificate costs money every year
unsigned exe triggers SmartScreen
the product still needs real-user validation
installer complexity is not the current bottleneck
```

## Tradeoff

Users need one of:

```text
Docker
Node.js 20+
```

This is a deliberate move from “consumer installer” to
“self-hosted / developer-friendly local AI host”.

## Release rules

```text
commit source and Docker files
publish Docker image when validated
attach portable zip only as optional artifact
never present unsigned exe as the default install path
never ask users to pipe a remote install script into a shell
```

## Future

Revisit code signing only when:

```text
there are real users
installer friction is proven to be the blocker
a trusted certificate budget is justified
```
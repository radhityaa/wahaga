async function checkLicense() {
    const licenseKey = process.env.LICENSE_KEY
    const server = process.env.LICENSE_SERVER

    if (!licenseKey || !server) {
        console.error('[LICENSE] LICENSE_KEY or LICENSE_SERVER not set')
        return false
    }

    try {
        const res = await fetch(`${server}/license/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                license_key: licenseKey
            })
        })

        if (!res.ok) {
            console.error('[LICENSE] Server responded', res.status)
            return false
        }

        const data = await res.json()
        return data.valid === true
    } catch (error) {
        console.error('[LICENSE] Request failed:', error.message)
        return false
    }
}

module.exports = {
    checkLicense
}
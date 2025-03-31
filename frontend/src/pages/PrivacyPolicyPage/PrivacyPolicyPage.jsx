import React from 'react'
import NavBar from '../../components/NavBar'
import Footer from '../../components/Footer'
import PrivacyPolicies from '../../components/PrivacyPolicies'

const PrivacyPolicyPage = () => {
  return (
    <div>
        <NavBar />
        <div className='pt-28'>
        <PrivacyPolicies/>
        </div>
        
    </div>
  )
}

export default PrivacyPolicyPage